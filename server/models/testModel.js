const { pool } = require('../config/db');
const caseAdminModel = require('./caseAdminModel');
const cache = require('../utils/cache');

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const testModel = {
  /** All blocks with a live count of attached questions (cached in RAM for instant loading). */
  async listBlocks() {
    return cache.getOrSet('tests:listBlocks', 120000, async () => {
      await caseAdminModel.ensureSynced();
      const [rows] = await pool.query(
        `SELECT t.id, t.block_number, t.title, t.block_type, t.system_id,
                t.total_questions, t.seconds_per_question, t.is_active,
                s.name AS system_name, s.slug AS system_slug, s.display_order AS system_order,
                COUNT(tq.id) AS question_count
         FROM tests t
         LEFT JOIN systems s ON s.id = t.system_id
         LEFT JOIN test_questions tq ON tq.test_id = t.id
         GROUP BY t.id, t.block_number, t.title, t.block_type, t.system_id,
                  t.total_questions, t.seconds_per_question, t.is_active,
                  s.name, s.slug, s.display_order
         ORDER BY t.block_type ASC, COALESCE(s.display_order, t.block_number) ASC`
      );
      return rows;
    });
  },

  async getBlockById(testId) {
    return cache.getOrSet(`tests:block:${testId}`, 120000, async () => {
      const [rows] = await pool.query('SELECT * FROM tests WHERE id = ? LIMIT 1', [testId]);
      return rows[0] || null;
    });
  },

  async getQuestionCount(testId) {
    const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM test_questions WHERE test_id = ?', [testId]);
    return row.count;
  },

  /**
   * Questions for an active attempt — safe fields only. Cached per block and freshly shuffled per attempt.
   */
  async getQuestionsForAttempt(testId) {
    const baseQuestions = await cache.getOrSet(`tests:questions:${testId}`, 120000, async () => {
      const [rows] = await pool.query(
        `SELECT tq.id AS test_question_id, tq.question_order, pc.id AS case_id,
                pc.title, pc.modality, pc.difficulty, pc.clinical_info, pc.question_text
         FROM test_questions tq
         JOIN practice_cases pc ON pc.id = tq.case_id
         WHERE tq.test_id = ?
         ORDER BY tq.question_order ASC`,
        [testId]
      );

      if (rows.length > 0) {
        const caseIds = rows.map((q) => q.case_id);
        const [allImages] = await pool.query(
          `SELECT id, case_id, image_url, display_order
           FROM case_images
           WHERE case_id IN (${caseIds.map(() => '?').join(',')})
           ORDER BY display_order ASC`,
          caseIds
        );
        const imgByCase = new Map();
        for (const img of allImages) {
          if (!imgByCase.has(img.case_id)) imgByCase.set(img.case_id, []);
          imgByCase.get(img.case_id).push(img);
        }
        for (const q of rows) {
          q.images = imgByCase.get(q.case_id) || [];
        }
      }
      return rows;
    });

    return shuffleArray(baseQuestions);
  },

  /** Case_id + correct_answer for one test_question, cached for instant grading. */
  async getGradingInfo(testQuestionId, testId) {
    const info = await this.getGradingInfoById(testQuestionId);
    if (!info || Number(info.test_id) !== Number(testId)) return null;
    return info;
  },

  async getGradingInfoById(testQuestionId) {
    return cache.getOrSet(`grading:q:${testQuestionId}`, 180000, async () => {
      const [rows] = await pool.query(
        `SELECT tq.case_id, tq.test_id, pc.correct_answer
         FROM test_questions tq
         JOIN practice_cases pc ON pc.id = tq.case_id
         WHERE tq.id = ?
         LIMIT 1`,
        [testQuestionId]
      );
      return rows[0] || null;
    });
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
       ON DUPLICATE KEY UPDATE
         student_answer = VALUES(student_answer),
         is_correct = VALUES(is_correct),
         time_taken_seconds = VALUES(time_taken_seconds)`,
      [attemptId, userId, testId, questionId, caseId, studentAnswer, isCorrect, timeTaken]
    );
  },

  async completeAttempt(attemptId) {
    const [[agg], [attemptRows]] = await Promise.all([
      pool.query(
        `SELECT SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct, COUNT(*) AS answered
         FROM test_answers WHERE attempt_id = ?`,
        [attemptId]
      ),
      pool.query('SELECT total_questions FROM test_attempts WHERE id = ? LIMIT 1', [attemptId]),
    ]);
    const aggRow = agg[0] || {};
    const attempt = attemptRows[0] || { total_questions: 1 };

    const score = Number(aggRow.correct) || 0;
    const total = Number(attempt.total_questions) || 1;
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
