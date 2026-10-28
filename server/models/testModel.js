const { pool } = require('../config/db');
const caseAdminModel = require('./caseAdminModel');

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const testModel = {
  /** All blocks with a live count of attached questions. */
  async listBlocks() {
    await caseAdminModel.autoSyncBlocks();
    const [rows] = await pool.query(
      `SELECT t.id, t.block_number, t.title, t.total_questions, t.seconds_per_question, t.is_active,
              COUNT(tq.id) AS question_count
       FROM tests t
       LEFT JOIN test_questions tq ON tq.test_id = t.id
       GROUP BY t.id, t.block_number, t.title, t.total_questions, t.seconds_per_question, t.is_active
       ORDER BY t.block_number ASC`
    );
    return rows;
  },

  async getBlockById(testId) {
    const [rows] = await pool.query('SELECT * FROM tests WHERE id = ? LIMIT 1', [testId]);
    return rows[0] || null;
  },

  async getQuestionCount(testId) {
    const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM test_questions WHERE test_id = ?', [testId]);
    return row.count;
  },

  /**
   * Questions for an active attempt — safe fields only. Never includes
   * correct_answer, explanation, key_findings, learning_points, or
   * differential_diagnosis; those stay server-side until results.
   */
  async getQuestionsForAttempt(testId) {
    const [rows] = await pool.query(
      `SELECT tq.id AS test_question_id, tq.question_order, pc.id AS case_id,
              pc.title, pc.modality, pc.difficulty, pc.clinical_info, pc.question_text
       FROM test_questions tq
       JOIN practice_cases pc ON pc.id = tq.case_id
       WHERE tq.test_id = ?
       ORDER BY tq.question_order ASC`,
      [testId]
    );

    for (const q of rows) {
      const [images] = await pool.query(
        'SELECT id, image_url, display_order FROM case_images WHERE case_id = ? ORDER BY display_order ASC',
        [q.case_id]
      );
      q.images = images;
    }
    return shuffleArray(rows);
  },

  /** Case_id + correct_answer for one test_question, used only for server-side grading. */
  async getGradingInfo(testQuestionId, testId) {
    const [rows] = await pool.query(
      `SELECT tq.case_id, pc.correct_answer
       FROM test_questions tq
       JOIN practice_cases pc ON pc.id = tq.case_id
       WHERE tq.id = ? AND tq.test_id = ?
       LIMIT 1`,
      [testQuestionId, testId]
    );
    return rows[0] || null;
  },

  async abandonInProgress(userId, testId) {
    await pool.query(
      `UPDATE test_attempts SET status = 'abandoned' WHERE user_id = ? AND test_id = ? AND status = 'in_progress'`,
      [userId, testId]
    );
  },

  async createAttempt(userId, testId, totalQuestions) {
    const [result] = await pool.query(
      `INSERT INTO test_attempts (user_id, test_id, status, total_questions) VALUES (?, ?, 'in_progress', ?)`,
      [userId, testId, totalQuestions]
    );
    return result.insertId;
  },

  async getAttempt(attemptId) {
    const [rows] = await pool.query('SELECT * FROM test_attempts WHERE id = ? LIMIT 1', [attemptId]);
    return rows[0] || null;
  },

  async saveAnswer({ attemptId, userId, testId, questionId, caseId, studentAnswer, isCorrect, timeTaken }) {
    await pool.query(
      `INSERT INTO test_answers
         (attempt_id, user_id, test_id, question_id, case_id, student_answer, is_correct, time_taken_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE attempt_id = attempt_id`, // first answer wins; replays are ignored
      [attemptId, userId, testId, questionId, caseId, studentAnswer, isCorrect, timeTaken]
    );
  },

  async completeAttempt(attemptId) {
    const [[agg]] = await pool.query(
      `SELECT SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct, COUNT(*) AS answered
       FROM test_answers WHERE attempt_id = ?`,
      [attemptId]
    );
    const [[attempt]] = await pool.query('SELECT total_questions FROM test_attempts WHERE id = ?', [attemptId]);

    const score = agg.correct || 0;
    const total = attempt.total_questions;
    const accuracy = total > 0 ? Number(((score / total) * 100).toFixed(1)) : 0;

    await pool.query(
      `UPDATE test_attempts SET status = 'completed', score = ?, accuracy = ?, completed_at = NOW() WHERE id = ?`,
      [score, accuracy, attemptId]
    );

    return { score, total, accuracy };
  },

  /** Full per-question review — only called after an attempt is completed. */
  async getAttemptReview(attemptId) {
    const [rows] = await pool.query(
      `SELECT ta.id, ta.question_id, ta.student_answer, ta.is_correct, ta.time_taken_seconds,
              tq.question_order,
              pc.title, pc.correct_answer, pc.explanation, pc.key_findings
       FROM test_answers ta
       JOIN test_questions tq ON tq.id = ta.question_id
       JOIN practice_cases pc ON pc.id = ta.case_id
       WHERE ta.attempt_id = ?
       ORDER BY tq.question_order ASC`,
      [attemptId]
    );
    return rows;
  },
};

module.exports = testModel;
