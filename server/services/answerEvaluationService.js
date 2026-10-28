/**
 * Server-side answer evaluation, shared by the Test system and AI Case Mentor.
 *
 * Supports:
 * - Multiple accepted alternatives separated by "|"
 * - Case, punctuation, and extra whitespace insensitivity
 * - Possessive "'s" normalization (e.g. "Ebstein's anomaly" == "Ebstein anomaly")
 * - British/American medical spelling normalization (tumour/tumor, ischaemic/ischemic, etc.)
 * - Fuzzy typo tolerance (Damerau-Levenshtein similarity) so minor 1-2 letter
 *   spelling slips (like "anamoly" vs "anomaly") are graded as Correct.
 */

const SPELLING_EQUIVALENTS = [
  [/\banamoly\b/g, 'anomaly'],
  [/\banamolies\b/g, 'anomalies'],
  [/\btumours?\b/g, 'tumor'],
  [/\btumors?\b/g, 'tumor'],
  [/\bischaemic\b/g, 'ischemic'],
  [/\bischaemia\b/g, 'ischemia'],
  [/\boedema\b/g, 'edema'],
  [/\bhaemorrhag/g, 'hemorrhag'],
  [/\bhaematoma\b/g, 'hematoma'],
  [/\boesophag/g, 'esophag'],
  [/\bpaediatric/g, 'pediatric'],
];

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'with', 'and', 'sign', 'syndrome', 'disease']);

function normalize(text) {
  let s = (text || '')
    .toString()
    .trim()
    .toLowerCase()
    // Remove leading list markers like "a.", "b.", "1.", "2)"
    .replace(/\b[a-d1-4]\s*[.)]\s*/g, ' ')
    // Strip possessive "'s" or "’s"
    .replace(/['’]s\b/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of SPELLING_EQUIVALENTS) {
    s = s.replace(pattern, replacement);
  }
  return s.replace(/\s+/g, ' ').trim();
}

function alternativesOf(correctAnswer) {
  return (correctAnswer || '')
    .toString()
    .split('|')
    .map((a) => a.trim())
    .filter((a) => normalize(a) !== '');
}

/** Damerau-Levenshtein edit distance (handles adjacent transpositions like "am" <-> "ma"). */
function editDistance(a, b) {
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;

  const dp = Array.from({ length: alen + 1 }, () => new Array(blen + 1).fill(0));
  for (let i = 0; i <= alen; i += 1) dp[i][0] = i;
  for (let j = 0; j <= blen; j += 1) dp[0][j] = j;

  for (let i = 1; i <= alen; i += 1) {
    for (let j = 1; j <= blen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost); // transposition
      }
    }
  }
  return dp[alen][blen];
}

/** Character-level similarity (0-100) between two normalized strings. */
function charSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = editDistance(a, b);
  return Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100));
}

/** Word-by-word fuzzy match: checks if every key word in `alt` is matched (exact or <= 2 typo distance) in `student`. */
function fuzzyWordsMatch(student, alt) {
  const sWords = student.split(' ').filter(Boolean);
  const aWords = alt.split(' ').filter(Boolean);
  if (sWords.length === 0 || aWords.length === 0) return false;

  // Filter core diagnostic words (keep all if filtering would leave 0)
  const coreAlt = aWords.filter((w) => !STOP_WORDS.has(w));
  const targetWords = coreAlt.length > 0 ? coreAlt : aWords;

  let matchedCount = 0;
  for (const aw of targetWords) {
    const allowedTypos = aw.length >= 7 ? 2 : aw.length >= 4 ? 1 : 0;
    const hit = sWords.some((sw) => {
      if (sw === aw) return true;
      if (allowedTypos === 0) return false;
      return editDistance(sw, aw) <= allowedTypos;
    });
    if (hit) matchedCount += 1;
  }

  return matchedCount === targetWords.length && sWords.length <= aWords.length + 3;
}

/** Token-overlap closeness (0-100) between two normalized strings. */
function tokenSimilarity(a, b) {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared += 1;
  });
  return Math.round((shared / (ta.size + tb.size - shared)) * 100);
}

/**
 * @returns {{ isCorrect: boolean|null, similarity: number|null }}
 *   isCorrect null  => case has no answer key yet (ungraded)
 */
function compareAnswers(studentAnswer, correctAnswer) {
  const alternatives = alternativesOf(correctAnswer);
  if (alternatives.length === 0) return { isCorrect: null, similarity: null };

  const student = normalize(studentAnswer);
  if (student === '') return { isCorrect: false, similarity: 0 };

  const normalizedAlternatives = alternatives.map(normalize);

  // 1. Exact normalized match
  if (normalizedAlternatives.includes(student)) {
    return { isCorrect: true, similarity: 100 };
  }

  // 2. Check fuzzy character similarity (>= 82% for words >= 5 chars) or word-level typo tolerance
  let bestSimilarity = 0;
  for (const alt of normalizedAlternatives) {
    const cSim = charSimilarity(student, alt);
    const tSim = tokenSimilarity(student, alt);
    const sim = Math.max(cSim, tSim);
    if (sim > bestSimilarity) bestSimilarity = sim;

    if ((alt.length >= 5 && cSim >= 82) || fuzzyWordsMatch(student, alt)) {
      return { isCorrect: true, similarity: Math.max(sim, 90) };
    }
  }

  return { isCorrect: false, similarity: bestSimilarity };
}

/** Boolean|null wrapper used by the Test system. */
function evaluateAnswer(studentAnswer, correctAnswer) {
  return compareAnswers(studentAnswer, correctAnswer).isCorrect;
}

/** First listed alternative — the "headline" diagnosis. */
function primaryAnswer(correctAnswer) {
  return alternativesOf(correctAnswer)[0] || null;
}

/** Every accepted alternative, for result screens: "A / B / C". */
function displayAnswer(correctAnswer) {
  const alts = alternativesOf(correctAnswer);
  return alts.length ? alts.join(' / ') : null;
}

module.exports = { normalize, compareAnswers, evaluateAnswer, primaryAnswer, displayAnswer };
