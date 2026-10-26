/**
 * Server-side answer evaluation, shared by the Test system and Navigation AI.
 *
 * Correct answers never leave the server before an answer is submitted.
 *
 * Answer keys may list accepted alternatives separated by "|", e.g.
 *   "Glioblastoma | GBM | Glioblastoma multiforme"
 * A student answer is correct if it matches ANY alternative after
 * normalization (case, punctuation and extra spaces are ignored).
 *
 * Matching is deliberately strict (exact after normalization): in a
 * diagnostic-training context a false "correct" is worse than a false
 * "incorrect". To add fuzzy/synonym/AI-assisted matching later, replace
 * `compareAnswers` — every caller goes through it.
 */

function normalize(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function alternativesOf(correctAnswer) {
  return (correctAnswer || '')
    .toString()
    .split('|')
    .map((a) => a.trim())
    .filter((a) => normalize(a) !== '');
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
  if (normalizedAlternatives.includes(student)) return { isCorrect: true, similarity: 100 };

  const similarity = Math.max(...normalizedAlternatives.map((alt) => tokenSimilarity(student, alt)));
  return { isCorrect: false, similarity };
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
