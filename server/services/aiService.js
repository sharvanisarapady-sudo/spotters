/**
 * AI Case Mentor Service.
 *
 * Combines:
 *  1. `trained` (Built-in Case-Bank & Medical Image Trained AI Mentor Engine) — trains
 *     automatically on every published case and uploaded medical scan image in the database.
 *     Requires zero external API keys and works 100% reliably out-of-the-box on cloud deploys.
 *  2. `gemini` (Gemini Multimodal Vision + Case-Bank RAG) — when AI_PROVIDER=gemini and AI_API_KEY
 *     are configured, inspects the uploaded scan pixels + trained case-bank examples.
 *  3. `groq` (Groq LLM + Trained Case-Bank baseline) — when AI_PROVIDER=groq and AI_API_KEY are set.
 */

const geminiProvider = require('./providers/geminiProvider');
const { judgeAnswer } = require('./providers/geminiJudge');
const groqClient = require('./providers/groqClient');
const {
  trainModel,
  getModelStatus,
  evaluateWithTrainedModel,
  generateHint,
  answerFollowUp,
} = require('./medicalCaseTrainer');

const DISCLAIMER =
  'Spotters.com is an educational platform and is not intended to replace clinical judgment, professional training, or medical advice.';

async function trainedCaseMentorProvider({ caseData, studentAnswer }) {
  const result = await evaluateWithTrainedModel({ caseData, studentAnswer });
  const status = result.modelStatus || getModelStatus();
  return {
    ...result,
    mode: 'trained-ai',
    notice: `AI Case Mentor (Model v${status.modelVersion || 1} · trained on ${
      status.trainedCasesCount || 1
    } uploaded radiology cases & ${status.trainedImagesCount || 1} medical scans).`,
    disclaimer: DISCLAIMER,
  };
}

async function geminiFeedbackProvider(input) {
  const base = await trainedCaseMentorProvider(input);
  if (base.verdict === 'unavailable') {
    return base;
  }

  let adjusted = {};
  if (base.verdict === 'incorrect' && !base.partial) {
    try {
      const j = await judgeAnswer({
        caseData: input.caseData,
        studentAnswer: input.studentAnswer,
        apiKey: input.apiKey,
        model: input.model || 'gemini-2.5-flash',
      });
      if (j.verdict === 'correct') {
        adjusted = {
          verdict: 'correct',
          partial: false,
          headline: 'Correct Diagnosis (AI-Checked)',
          matchLabel: 'Accepted as equivalent to the recorded diagnosis (AI-checked)',
        };
      } else if (j.verdict === 'partial') {
        adjusted = {
          partial: true,
          headline: 'Partially Correct',
          matchLabel: 'Close: partly correct, but not specific enough',
        };
      }
    } catch {
      // Keep trained model verdict
    }
  }

  const mergedBase = { ...base, ...adjusted };

  const fb = await geminiProvider.generateFeedback({
    caseData: input.caseData,
    studentAnswer: input.studentAnswer,
    verdict: mergedBase.partial ? 'partially correct (right track, not specific enough)' : mergedBase.verdict,
    apiKey: input.apiKey,
    model: input.model || 'gemini-2.5-flash',
  });

  const status = getModelStatus();
  return {
    ...mergedBase,
    mode: 'gemini-vision',
    reasoning: fb.reasoning,
    missedFindings: mergedBase.verdict === 'incorrect' ? fb.missedFindings || mergedBase.missedFindings : null,
    notice: `AI Case Mentor Vision + Case-Bank Model (v${status.modelVersion || 1} · grounded in ${
      status.trainedCasesCount || 1
    } uploaded cases).`,
    disclaimer: DISCLAIMER,
  };
}

async function groqFeedbackProvider(input) {
  const base = await trainedCaseMentorProvider(input);
  if (base.verdict === 'unavailable') {
    return base;
  }

  const fb = await groqClient.createMessage({
    apiKey: input.apiKey,
    model: input.model,
    system: `You are an expert Radiology Attending & AI Case Mentor.
Use ONLY information in the supplied case record. Do not add external clinical advice.
The verdict has already been determined. Speak warmly and educationally in 3 paragraphs separated by blank lines:
(1) why the student's answer was right, close (if they named a differential or finding), or wrong;
(2) walk through each recorded key imaging finding on the scan;
(3) how to distinguish the recorded differentials + a concrete exam pearl from the learning points.
Return ONLY JSON: {"reasoning":"...","missed_findings":"... or null"}`,
    user: JSON.stringify({
      verdict: base.partial ? 'partially correct' : base.verdict,
      modality: input.caseData.modality,
      recordedDiagnosis: input.caseData.correct_answer,
      clinicalInfo: input.caseData.clinical_info,
      question: input.caseData.question_text,
      explanation: input.caseData.explanation,
      keyFindings: input.caseData.key_findings,
      learningPoints: input.caseData.learning_points,
      differentialDiagnosis: input.caseData.differential_diagnosis,
      studentAnswer: String(input.studentAnswer || '').slice(0, 500),
    }),
  });

  const start = fb.text.indexOf('{');
  const end = fb.text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Groq returned invalid response');
  const parsed = JSON.parse(fb.text.slice(start, end + 1));
  if (typeof parsed.reasoning !== 'string' || !parsed.reasoning.trim()) {
    throw new Error('Groq returned empty reasoning');
  }

  const status = getModelStatus();
  return {
    ...base,
    mode: 'groq-ai',
    reasoning: parsed.reasoning.trim().slice(0, 3000),
    missedFindings:
      base.verdict === 'incorrect' && typeof parsed.missed_findings === 'string'
        ? parsed.missed_findings.trim().slice(0, 1500) || base.missedFindings
        : null,
    notice: `AI Case Mentor + Case-Bank Model (v${status.modelVersion || 1} · grounded in ${
      status.trainedCasesCount || 1
    } uploaded cases).`,
    disclaimer: DISCLAIMER,
  };
}

const providers = {
  trained: trainedCaseMentorProvider,
  demo: trainedCaseMentorProvider,
  gemini: geminiFeedbackProvider,
  groq: groqFeedbackProvider,
};

function resolveProvider() {
  const requested = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const hasKey = Boolean((process.env.AI_API_KEY || '').trim());
  if (requested && providers[requested] && (requested === 'trained' || requested === 'demo' || hasKey)) {
    return { name: requested, fn: providers[requested] };
  }
  return { name: 'trained', fn: trainedCaseMentorProvider };
}

function describeConfig() {
  const { name } = resolveProvider();
  if (name === 'trained' || name === 'demo') {
    return 'provider=trained-case-mentor (Case-Bank & Medical Image Trained AI Mentor active)';
  }
  return `provider=${name} model=${process.env.AI_MODEL || 'default'} key=${process.env.AI_API_KEY ? 'set' : 'missing'}`;
}

async function analyzeAnswer({ caseData, studentAnswer }) {
  const provider = resolveProvider();
  const input = {
    caseData,
    studentAnswer,
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
  };

  try {
    const result = await provider.fn(input);
    return { ...result, fallback: false };
  } catch (err) {
    console.error(`[ai] external provider "${provider.name}" failed (${err.kind || err.message}); using trained case mentor`);
    const trained = await trainedCaseMentorProvider(input);
    return { ...trained, fallback: true };
  }
}

module.exports = {
  analyzeAnswer,
  describeConfig,
  trainModel,
  getModelStatus,
  generateHint,
  answerFollowUp,
  DISCLAIMER,
};
