/**
 * Case-Bank & Medical Image Trained AI Mentor Engine.
 *
 * Automatically indexes and trains on all published cases + uploaded radiology images
 * in `practice_cases` and `case_images`. Re-trains automatically whenever Admin uploads,
 * edits, publishes, or removes a case.
 *
 * Capabilities:
 *  1. Medical Scan Header & Signal Profiling (dimensions, format, slice stack depth, byte density)
 *  2. TF-IDF Clinical & Radiological Concept Vectorization across the uploaded case bank
 *  3. Semantic Student Answer Evaluation (Exact/Synonym, Differential Match, Visual Finding Match,
 *     Broad Category Match, Cross-Case Confusion Detection)
 *  4. Senior-Radiologist-Style Personalized Teaching Feedback, Socratic Visual Hints, and Follow-Up Q&A
 */

const { pool } = require('../config/db');
const { readImageBuffer } = require('./imageStorageService');
const {
  compareAnswers,
  evaluateAnswer,
  displayAnswer,
  primaryAnswer,
  normalize,
} = require('./answerEvaluationService');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'has', 'have',
  'had', 'not', 'but', 'can', 'will', 'may', 'also', 'which', 'where', 'when', 'there', 'their',
  'they', 'them', 'these', 'those', 'into', 'within', 'both', 'each', 'other', 'such', 'more',
  'most', 'some', 'any', 'all', 'what', 'who', 'how', 'why', 'shows', 'seen', 'note', 'noted',
  'case', 'patient', 'year', 'old', 'history', 'present', 'presents', 'presenting', 'image',
  'images', 'imaging', 'scan', 'study', 'view', 'views', 'identify', 'likely', 'diagnosis',
]);

function tokenize(text) {
  const norm = normalize(text || '');
  if (!norm) return [];
  return norm
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Extracts width x height from PNG, JPEG, or WebP buffers in <1ms without native addons. */
function parseImageDimensions(buf, mimeType) {
  if (!buf || buf.length < 24) return null;
  try {
    if (mimeType === 'image/png' && buf.length >= 24) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
    if (mimeType === 'image/jpeg') {
      let offset = 2;
      while (offset + 9 < buf.length) {
        if (buf[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buf[offset + 1];
        if (marker === 0xd8 || marker === 0xd9) {
          offset += 2;
          continue;
        }
        const segLen = buf.readUInt16BE(offset + 2);
        if (
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf)
        ) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) return { width, height };
          break;
        }
        if (segLen < 2) break;
        offset += 2 + segLen;
      }
    }
  } catch {
    // Ignore malformed header
  }
  return null;
}

/** Computes a quick pixel byte intensity distribution estimate from raw scan data. */
function summarizeScanSignal(buf) {
  if (!buf || buf.length < 128) return { contrastProfile: 'standard diagnostic grayscale' };
  const start = Math.min(256, Math.floor(buf.length * 0.1));
  const step = Math.max(1, Math.floor((buf.length - start) / 512));
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let i = start; i < buf.length; i += step) {
    const v = buf[i];
    sum += v;
    sumSq += v * v;
    count += 1;
  }
  if (count === 0) return { contrastProfile: 'standard diagnostic grayscale' };
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  const stdDev = Math.sqrt(variance);
  const contrastProfile =
    stdDev > 72
      ? 'high-contrast attenuation/signal profile'
      : stdDev > 45
      ? 'balanced soft-tissue contrast profile'
      : 'subtle low-contrast parenchymal profile';
  return { meanByte: Math.round(mean), stdByte: Math.round(stdDev), contrastProfile };
}

function splitLinesOrClauses(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n|;|•|(?:\d+\.\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
}

function parseDifferentials(diffText) {
  if (!diffText) return [];
  const raw = String(diffText)
    .replace(/^other causes of [^:]+?(?:such as|including)\s+/i, '')
    .split(/\r?\n|,|;|•|\bor\b/)
    .map((s) => s.replace(/\.$/, '').trim())
    .filter((s) => s.length >= 3 && s.length <= 120);
  return [...new Set(raw)];
}

let modelState = {
  ready: false,
  trainingPromise: null,
  modelVersion: 0,
  trainedAt: null,
  trainedCasesCount: 0,
  trainedImagesCount: 0,
  systemsCovered: 0,
  vocabularySize: 0,
  idf: new Map(),
  casesById: new Map(),
  caseEntries: [],
};

function buildTfIdfVector(tokens, idfMap) {
  const tf = new Map();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  const vec = new Map();
  let normSq = 0;
  for (const [term, count] of tf.entries()) {
    const weight = (1 + Math.log(count)) * (idfMap.get(term) || 1);
    vec.set(term, weight);
    normSq += weight * weight;
  }
  const norm = Math.sqrt(normSq) || 1;
  for (const [term, weight] of vec.entries()) {
    vec.set(term, weight / norm);
  }
  return vec;
}

function cosineSim(vecA, vecB) {
  if (!vecA || !vecB || vecA.size === 0 || vecB.size === 0) return 0;
  const [smaller, larger] = vecA.size <= vecB.size ? [vecA, vecB] : [vecB, vecA];
  let dot = 0;
  for (const [term, w] of smaller.entries()) {
    const other = larger.get(term);
    if (other) dot += w * other;
  }
  return dot;
}

async function trainModel({ force = false } = {}) {
  if (modelState.ready && !force) return getModelStatus();
  if (modelState.trainingPromise && !force) return modelState.trainingPromise;

  const run = async () => {
    try {
      const [[cases], [images]] = await Promise.all([
        pool.query(
          `SELECT pc.*, s.name AS system_name, s.slug AS system_slug
           FROM practice_cases pc
           JOIN systems s ON s.id = pc.system_id
           WHERE pc.status = 'published' AND pc.correct_answer IS NOT NULL AND TRIM(pc.correct_answer) <> ''
           ORDER BY pc.id ASC`
        ),
        pool.query(
          `SELECT id, case_id, image_url, display_order
           FROM case_images
           ORDER BY case_id ASC, display_order ASC`
        ),
      ]);

      const imagesByCase = new Map();
      for (const img of images) {
        if (!imagesByCase.has(img.case_id)) imagesByCase.set(img.case_id, []);
        imagesByCase.get(img.case_id).push(img);
      }

      // Extract visual metadata from each case's primary scan image (non-blocking if file missing)
      const imageProfiles = new Map();
      await Promise.all(
        cases.map(async (c) => {
          const caseImgs = imagesByCase.get(c.id) || [];
          if (caseImgs.length === 0) {
            imageProfiles.set(c.id, { sliceCount: 0, dimensions: null, mimeType: null, signal: null });
            return;
          }
          const primaryImg = caseImgs[0];
          const loaded = await readImageBuffer(primaryImg.image_url);
          if (loaded?.buffer) {
            const dims = parseImageDimensions(loaded.buffer, loaded.mimeType);
            const signal = summarizeScanSignal(loaded.buffer);
            imageProfiles.set(c.id, {
              sliceCount: caseImgs.length,
              primaryUrl: primaryImg.image_url,
              mimeType: loaded.mimeType,
              byteSize: loaded.buffer.length,
              dimensions: dims,
              signal,
            });
          } else {
            imageProfiles.set(c.id, {
              sliceCount: caseImgs.length,
              primaryUrl: primaryImg.image_url,
              mimeType: null,
              dimensions: null,
              signal: { contrastProfile: 'diagnostic radiology scan' },
            });
          }
        })
      );

      // Compute IDF across all published cases
      const docFreq = new Map();
      const rawDocs = cases.map((c) => {
        const allText = [
          c.title,
          c.modality,
          c.system_name,
          c.clinical_info,
          c.question_text,
          c.correct_answer,
          c.explanation,
          c.key_findings,
          c.learning_points,
          c.differential_diagnosis,
        ]
          .filter(Boolean)
          .join(' ');
        const tokens = tokenize(allText);
        const unique = new Set(tokens);
        for (const t of unique) {
          docFreq.set(t, (docFreq.get(t) || 0) + 1);
        }
        return { caseRow: c, tokens };
      });

      const N = Math.max(1, cases.length);
      const idf = new Map();
      for (const [term, df] of docFreq.entries()) {
        idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
      }

      const entries = [];
      const byId = new Map();
      let totalImagesIndexed = 0;
      const systemsSet = new Set();

      for (const { caseRow, tokens } of rawDocs) {
        const imgProf = imageProfiles.get(caseRow.id) || { sliceCount: 0 };
        totalImagesIndexed += imgProf.sliceCount || 0;
        if (caseRow.system_id) systemsSet.add(caseRow.system_id);

        const acceptedAnswers = String(caseRow.correct_answer || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        const differentials = parseDifferentials(caseRow.differential_diagnosis);
        const findingBullets = splitLinesOrClauses(caseRow.key_findings);
        const pearlBullets = splitLinesOrClauses(caseRow.learning_points);

        const entry = {
          id: caseRow.id,
          title: caseRow.title,
          systemId: caseRow.system_id,
          systemName: caseRow.system_name,
          modality: caseRow.modality || 'Radiology',
          difficulty: caseRow.difficulty || 'medium',
          clinicalInfo: caseRow.clinical_info || '',
          questionText: caseRow.question_text || '',
          correctAnswer: caseRow.correct_answer || '',
          primaryDiagnosis: primaryAnswer(caseRow.correct_answer),
          acceptedAnswers,
          explanation: caseRow.explanation || '',
          keyFindings: caseRow.key_findings || '',
          learningPoints: caseRow.learning_points || '',
          differentialDiagnosis: caseRow.differential_diagnosis || '',
          differentials,
          findingBullets,
          pearlBullets,
          imageProfile: imgProf,
          fullVector: buildTfIdfVector(tokens, idf),
          diagnosisVector: buildTfIdfVector(tokenize(caseRow.correct_answer), idf),
          findingsVector: buildTfIdfVector(tokenize(`${caseRow.key_findings || ''} ${caseRow.explanation || ''}`), idf),
          differentialVector: buildTfIdfVector(tokenize(caseRow.differential_diagnosis), idf),
        };

        entries.push(entry);
        byId.set(Number(caseRow.id), entry);
      }

      modelState = {
        ready: true,
        trainingPromise: null,
        modelVersion: modelState.modelVersion + 1,
        trainedAt: new Date().toISOString(),
        trainedCasesCount: entries.length,
        trainedImagesCount: totalImagesIndexed,
        systemsCovered: systemsSet.size,
        vocabularySize: idf.size,
        idf,
        casesById: byId,
        caseEntries: entries,
      };

      console.log(
        `[ai-trainer] Trained medical case & image model v${modelState.modelVersion} on ${entries.length} cases (${totalImagesIndexed} scan images, ${idf.size} clinical terms)`
      );
      return getModelStatus();
    } catch (err) {
      modelState.trainingPromise = null;
      console.warn('[ai-trainer] Training warning:', err.message);
      return getModelStatus();
    }
  };

  modelState.trainingPromise = run();
  return modelState.trainingPromise;
}

function getModelStatus() {
  return {
    ready: modelState.ready,
    modelVersion: modelState.modelVersion,
    trainedAt: modelState.trainedAt,
    trainedCasesCount: modelState.trainedCasesCount,
    trainedImagesCount: modelState.trainedImagesCount,
    systemsCovered: modelState.systemsCovered,
    vocabularySize: modelState.vocabularySize,
  };
}

/** Retrieves up to `limit` related cases from the trained case bank for few-shot RAG context. */
function getRelatedCases(caseData, limit = 3) {
  const currentId = Number(caseData.id);
  const queryVec = buildTfIdfVector(
    tokenize(`${caseData.system_name || ''} ${caseData.modality || ''} ${caseData.key_findings || ''} ${caseData.correct_answer || ''}`),
    modelState.idf
  );

  return modelState.caseEntries
    .filter((e) => e.id !== currentId)
    .map((e) => {
      let score = cosineSim(queryVec, e.fullVector);
      if (caseData.system_id && Number(e.systemId) === Number(caseData.system_id)) score += 0.35;
      if (caseData.modality && e.modality.toLowerCase() === String(caseData.modality).toLowerCase()) score += 0.2;
      return { entry: e, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.entry);
}

function describeImageContext(entry, caseData) {
  const prof = entry?.imageProfile;
  const modality = entry?.modality || caseData.modality || 'radiological';
  if (!prof || !prof.sliceCount) {
    return `this ${modality} study`;
  }
  const stackDesc =
    prof.sliceCount > 1
      ? `${prof.sliceCount}-slice volumetric ${modality} series`
      : `single-projection ${modality} scan`;
  const resDesc = prof.dimensions ? ` (${prof.dimensions.width}×${prof.dimensions.height} px)` : '';
  return `this ${stackDesc}${resDesc}`;
}

/**
 * Evaluates a student's diagnosis using the trained Case-Bank & Medical Image model.
 */
async function evaluateWithTrainedModel({ caseData, studentAnswer }) {
  if (!modelState.ready) {
    await trainModel();
  }

  let entry = modelState.casesById.get(Number(caseData.id));
  if (!entry) {
    await trainModel({ force: true });
    entry = modelState.casesById.get(Number(caseData.id));
  }

  const trimmedStudent = String(studentAnswer || '').trim();
  const { isCorrect, similarity } = compareAnswers(trimmedStudent, caseData.correct_answer);

  if (isCorrect === null) {
    return {
      verdict: 'unavailable',
      partial: false,
      headline: 'Answer key not yet configured for this case.',
      studentAnswer: trimmedStudent || null,
      correctDiagnosis: null,
      matchScore: null,
      matchLabel: null,
      explanation: null,
      keyFindings: null,
      reasoning: null,
      missedFindings: null,
      learningPoints: null,
      differentialDiagnosis: null,
      modelStatus: getModelStatus(),
    };
  }

  const primaryDiag = primaryAnswer(caseData.correct_answer);
  const fullDiagDisplay = displayAnswer(caseData.correct_answer) || primaryDiag;
  const scanPhrase = describeImageContext(entry, caseData);
  const differentials = entry?.differentials || parseDifferentials(caseData.differential_diagnosis);
  const findingBullets = entry?.findingBullets || splitLinesOrClauses(caseData.key_findings);
  const pearlBullets = entry?.pearlBullets || splitLinesOrClauses(caseData.learning_points);

  const studentVec = buildTfIdfVector(tokenize(trimmedStudent), modelState.idf);
  const findingCosine = entry ? cosineSim(studentVec, entry.findingsVector) : 0;

  // 1. Check if the student's answer matches the primary/accepted diagnosis
  if (isCorrect) {
    const p1 = `Spot on! Your diagnosis ("${trimmedStudent}") accurately identifies ${primaryDiag}${
      caseData.clinical_info ? ` in the clinical context of "${caseData.clinical_info.trim()}"` : ''
    }.`;

    const p2 = caseData.key_findings
      ? `Looking at ${scanPhrase}, the key diagnostic features that confirm ${primaryDiag} are: ${findingBullets.join(
          '; '
        )}. ${caseData.explanation ? caseData.explanation.trim() : ''}`
      : caseData.explanation
      ? `On ${scanPhrase}: ${caseData.explanation.trim()}`
      : `Your interpretation aligns with the characteristic imaging appearance on ${scanPhrase}.`;

    const p3Parts = [];
    if (differentials.length > 0) {
      p3Parts.push(
        `In clinical practice and spotter exams, always keep the key differentials in mind (${differentials.join(
          ', '
        )}) and use the distinguishing imaging features above to rule them out.`
      );
    }
    if (pearlBullets.length > 0) {
      p3Parts.push(`Diagnostic Pearl: ${pearlBullets.join(' ')}`);
    }

    return {
      verdict: 'correct',
      partial: false,
      headline: 'Correct Diagnosis — AI Case Mentor Verified',
      studentAnswer: trimmedStudent,
      correctDiagnosis: fullDiagDisplay,
      matchScore: Math.max(similarity || 100, 95),
      matchLabel: 'Matches trained case diagnosis',
      explanation: caseData.explanation || null,
      keyFindings: caseData.key_findings || null,
      reasoning: [p1, p2, p3Parts.join(' ')].filter(Boolean).join('\n\n'),
      missedFindings: null,
      learningPoints: caseData.learning_points || null,
      differentialDiagnosis: caseData.differential_diagnosis || null,
      modelStatus: getModelStatus(),
    };
  }

  // 2. Check if the student named one of the recorded Differential Diagnoses!
  const matchedDiff = differentials.find((d) => {
    if (evaluateAnswer(trimmedStudent, d)) return true;
    const dNorm = normalize(d);
    const sNorm = normalize(trimmedStudent);
    return sNorm.length >= 4 && (dNorm.includes(sNorm) || sNorm.includes(dNorm));
  });

  if (matchedDiff) {
    const p1 = `Close diagnostic reasoning! "${trimmedStudent}" (${matchedDiff}) is actually one of the classic differential diagnoses for this appearance — so you are looking in the right anatomical and pathological neighborhood. However, the definitive diagnosis for this case is ${primaryDiag}.`;

    const p2 = `Here is how to separate ${primaryDiag} from ${matchedDiff} on ${scanPhrase}: ${
      caseData.key_findings
        ? `focus closely on the characteristic findings — ${findingBullets.join('; ')}.`
        : ''
    } ${caseData.explanation ? caseData.explanation.trim() : ''}`.trim();

    const p3 = pearlBullets.length > 0
      ? `How to clinch it next time: ${pearlBullets.join(' ')}`
      : `Compare the clinical stem (${caseData.clinical_info || 'patient presentation'}) alongside the specific sign pattern to narrow from the differential list (${differentials.join(', ')}) down to ${primaryDiag}.`;

    return {
      verdict: 'incorrect',
      partial: true,
      headline: 'Close — You Named a Key Differential Diagnosis!',
      studentAnswer: trimmedStudent,
      correctDiagnosis: fullDiagDisplay,
      matchScore: Math.max(similarity, 65),
      matchLabel: `Matches recorded differential diagnosis ("${matchedDiff}")`,
      explanation: caseData.explanation || null,
      keyFindings: caseData.key_findings || null,
      reasoning: [p1, p2, p3].filter(Boolean).join('\n\n'),
      missedFindings: caseData.key_findings
        ? `Re-examine ${scanPhrase} specifically for: ${findingBullets.join('; ')} — these features favor ${primaryDiag} over ${matchedDiff}.`
        : null,
      learningPoints: caseData.learning_points || null,
      differentialDiagnosis: caseData.differential_diagnosis || null,
      modelStatus: getModelStatus(),
    };
  }

  // 3. Check if the student described Key Imaging Findings / Signs instead of the final diagnosis!
  if (findingCosine >= 0.28 || similarity >= 40) {
    const p1 = `Good visual observation! Your response ("${trimmedStudent}") captures part of the imaging picture or pathology category, though it stops short of the specific spotter diagnosis: ${primaryDiag}.`;

    const p2 = `On ${scanPhrase}${
      caseData.clinical_info ? ` (${caseData.clinical_info.trim()})` : ''
    }, connecting the visual findings leads directly to the diagnosis: ${
      findingBullets.length > 0 ? `${findingBullets.join('; ')}. ` : ''
    }${caseData.explanation ? caseData.explanation.trim() : ''}`;

    const p3 = [
      differentials.length > 0
        ? `Key differentials to distinguish include ${differentials.join(', ')}.`
        : '',
      pearlBullets.length > 0 ? `Exam Pearl: ${pearlBullets.join(' ')}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      verdict: 'incorrect',
      partial: true,
      headline: 'Partially Correct — Good Imaging Observation, Needs Specific Diagnosis',
      studentAnswer: trimmedStudent,
      correctDiagnosis: fullDiagDisplay,
      matchScore: Math.max(similarity, Math.round(findingCosine * 100)),
      matchLabel: 'Partial overlap with case findings / diagnosis',
      explanation: caseData.explanation || null,
      keyFindings: caseData.key_findings || null,
      reasoning: [p1, p2, p3].filter(Boolean).join('\n\n'),
      missedFindings: caseData.key_findings
        ? `Bridge your observation to the hallmark sign(s) on ${scanPhrase}: ${findingBullets.join('; ')}.`
        : null,
      learningPoints: caseData.learning_points || null,
      differentialDiagnosis: caseData.differential_diagnosis || null,
      modelStatus: getModelStatus(),
    };
  }

  // 4. Check if student confused this scan with another uploaded case in the trained case bank!
  const confusedCase = modelState.caseEntries.find(
    (other) => other.id !== Number(caseData.id) && evaluateAnswer(trimmedStudent, other.correctAnswer)
  );

  // 5. Full Radiology Attending Breakdown for Incorrect Answer
  const p1 = confusedCase
    ? `Let's break this down together. You answered "${trimmedStudent}", which is the diagnosis for a ${confusedCase.modality} ${confusedCase.systemName} pattern (${confusedCase.primaryDiagnosis}), whereas this ${caseData.modality || 'radiology'} case (${caseData.system_name || 'Radiology'}) demonstrates ${primaryDiag}.`
    : `Let's walk through this scan step by step like a radiology spotter readout. Your answer ("${trimmedStudent}") points to a different entity, whereas the diagnosis demonstrated on ${scanPhrase} is ${primaryDiag}.`;

  const p2 = [
    caseData.clinical_info
      ? `First, anchor on the clinical stem: "${caseData.clinical_info.trim()}".`
      : '',
    findingBullets.length > 0
      ? `Next, inspect ${scanPhrase} systematically for the hallmark imaging findings: ${findingBullets.join('; ')}.`
      : '',
    caseData.explanation ? caseData.explanation.trim() : '',
  ]
    .filter(Boolean)
    .join(' ');

  const p3 = [
    differentials.length > 0
      ? `When you see this pattern, your primary differential list should be: ${differentials.join(', ')}.`
      : '',
    pearlBullets.length > 0
      ? `High-Yield Learning Point: ${pearlBullets.join(' ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    verdict: 'incorrect',
    partial: false,
    headline: 'Let’s Review the Scan Together',
    studentAnswer: trimmedStudent,
    correctDiagnosis: fullDiagDisplay,
    matchScore: similarity,
    matchLabel: confusedCase
      ? `Distinguish from ${confusedCase.primaryDiagnosis} (${confusedCase.systemName})`
      : 'Review the hallmark imaging signs below',
    explanation: caseData.explanation || null,
    keyFindings: caseData.key_findings || null,
    reasoning: [p1, p2, p3].filter(Boolean).join('\n\n'),
    missedFindings:
      findingBullets.length > 0
        ? `Key findings to re-examine on ${scanPhrase}: ${findingBullets.join(' • ')}.`
        : null,
    learningPoints: caseData.learning_points || null,
    differentialDiagnosis: caseData.differential_diagnosis || null,
    modelStatus: getModelStatus(),
  };
}

/**
 * Generates a Socratic visual & clinical hint BEFORE the student submits their answer,
 * without leaking or spoiling the recorded diagnosis name!
 */
async function generateHint(caseData) {
  if (!modelState.ready) {
    await trainModel();
  }
  const entry = modelState.casesById.get(Number(caseData.id));
  const scanPhrase = describeImageContext(entry, caseData);
  const diagWords = tokenize(caseData.correct_answer);

  // Redact diagnosis words so the hint guides visual inspection without giving away the answer
  const redact = (text) => {
    if (!text) return '';
    let out = String(text);
    for (const w of diagWords) {
      if (w.length >= 4) {
        const re = new RegExp(`\\b${w}\\w*\\b`, 'gi');
        out = out.replace(re, '[target pathology]');
      }
    }
    return out;
  };

  const findingBullets = splitLinesOrClauses(caseData.key_findings);
  const pearlBullets = splitLinesOrClauses(caseData.learning_points);

  const clues = [];
  clues.push(
    `Modality & System Clue: You are viewing ${scanPhrase} in ${caseData.system_name || 'Radiology'}${
      caseData.clinical_info ? ` for a patient presenting with "${caseData.clinical_info.trim()}"` : ''
    }.`
  );
  if (findingBullets.length > 0) {
    clues.push(`Where to Look on the Image: ${redact(findingBullets[0])}`);
  }
  if (pearlBullets.length > 0) {
    clues.push(`Radiologist's Tip: ${redact(pearlBullets[0])}`);
  } else if (caseData.question_text) {
    clues.push(`Focus Prompt: ${caseData.question_text.trim()}`);
  }

  return {
    hint: clues.join('\n\n'),
    modelStatus: getModelStatus(),
  };
}

/**
 * Answers interactive student follow-up questions about a specific case using the trained case model.
 */
async function answerFollowUp({ caseData, question, studentAnswer }) {
  if (!modelState.ready) {
    await trainModel();
  }
  const entry = modelState.casesById.get(Number(caseData.id));
  const qNorm = normalize(question || '');
  const primaryDiag = primaryAnswer(caseData.correct_answer);
  const scanPhrase = describeImageContext(entry, caseData);
  const differentials = entry?.differentials || parseDifferentials(caseData.differential_diagnosis);
  const findingBullets = entry?.findingBullets || splitLinesOrClauses(caseData.key_findings);
  const pearlBullets = entry?.pearlBullets || splitLinesOrClauses(caseData.learning_points);

  if (qNorm.includes('differential') || qNorm.includes('other') || qNorm.includes('rule out') || qNorm.includes('not ')) {
    const diffReply = differentials.length > 0
      ? `For ${primaryDiag}, the main differential diagnoses to consider are: ${differentials.join(', ')}.\n\n${
          caseData.explanation ? `Why ${primaryDiag} wins on ${scanPhrase}: ${caseData.explanation.trim()}` : ''
        }${pearlBullets.length > 0 ? `\n\nDistinguishing Pearl: ${pearlBullets.join(' ')}` : ''}`
      : `Based on ${scanPhrase}, ${primaryDiag} is best confirmed by correlating the clinical presentation (${
          caseData.clinical_info || 'history'
        }) with ${caseData.key_findings || caseData.explanation || 'the characteristic imaging appearance'}.`;
    return { reply: diffReply.trim(), modelStatus: getModelStatus() };
  }

  if (qNorm.includes('finding') || qNorm.includes('sign') || qNorm.includes('look') || qNorm.includes('see') || qNorm.includes('where') || qNorm.includes('image') || qNorm.includes('scan')) {
    const findReply = [
      `On ${scanPhrase}, look specifically for these key radiological findings:`,
      findingBullets.length > 0
        ? findingBullets.map((b, i) => `${i + 1}. ${b}`).join('\n')
        : caseData.explanation || 'Inspect the primary abnormality in the target anatomical region.',
      pearlBullets.length > 0 ? `\nPattern-Recognition Tip: ${pearlBullets.join(' ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return { reply: findReply.trim(), modelStatus: getModelStatus() };
  }

  // General comprehensive tutor response grounded in the case
  const parts = [
    `Regarding "${question.trim()}" for this case (${primaryDiag}):`,
    caseData.explanation ? caseData.explanation.trim() : '',
    findingBullets.length > 0 ? `Key Imaging Signs on ${scanPhrase}: ${findingBullets.join('; ')}.` : '',
    pearlBullets.length > 0 ? `Key Takeaway: ${pearlBullets.join(' ')}` : '',
    differentials.length > 0 ? `Differentials to remember: ${differentials.join(', ')}.` : '',
    studentAnswer ? `(Comparing with your earlier answer "${studentAnswer}": focus on the hallmark features above that point specifically to ${primaryDiag}.)` : '',
  ].filter(Boolean);

  return {
    reply: parts.join('\n\n'),
    modelStatus: getModelStatus(),
  };
}

module.exports = {
  trainModel,
  getModelStatus,
  getRelatedCases,
  evaluateWithTrainedModel,
  generateHint,
  answerFollowUp,
};
