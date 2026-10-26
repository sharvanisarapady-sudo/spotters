const { pool } = require('../config/db');

/**
 * Progress aggregates. Every figure is computed from real activity rows.
 * Ungraded answers (is_correct IS NULL — the case had no answer key when
 * answered) are excluded from accuracy so they can't silently count as wrong.
 */
const progressModel = {
  async getOverview(userId) {
    const [[completed]] = await pool.query(
      `SELECT COUNT(*) AS tests_completed,
              AVG(score) AS avg_score,
              AVG(accuracy) AS avg_accuracy,
              MAX(score) AS best_score
       FROM test_attempts
       WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    const [[best]] = await pool.query(
      `SELECT score, total_questions
       FROM test_attempts
       WHERE user_id = ? AND status = 'completed' AND score IS NOT NULL
       ORDER BY score DESC, completed_at DESC
       LIMIT 1`,
      [userId]
    );

    const [[answers]] = await pool.query(
      `SELECT COUNT(*) AS attempted,
              COUNT(is_correct) AS graded,
              SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM test_answers
       WHERE user_id = ?`,
      [userId]
    );

    const [[bookmarks]] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM bookmarks b
       JOIN practice_cases pc ON pc.id = b.case_id AND pc.status = 'published'
       WHERE b.user_id = ?`,
      [userId]
    );

    const graded = Number(answers.graded) || 0;
    const correct = Number(answers.correct) || 0;

    return {
      testsCompleted: Number(completed.tests_completed) || 0,
      questionsAttempted: Number(answers.attempted) || 0,
      correctAnswers: correct,
      overallAccuracy: graded > 0 ? Number(((correct / graded) * 100).toFixed(1)) : null,
      averageScore: completed.avg_score !== null ? Number(Number(completed.avg_score).toFixed(1)) : null,
      bestScore: best ? { score: best.score, total: best.total_questions } : null,
      bookmarkedCases: Number(bookmarks.count) || 0,
    };
  },

  /** All systems (even with no activity), with accuracy where attempts exist. */
  async getSystemPerformance(userId) {
    const [rows] = await pool.query(
      `SELECT s.id, s.name, s.slug, s.display_order,
              COUNT(ta.is_correct) AS attempted,
              SUM(CASE WHEN ta.is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM systems s
       LEFT JOIN practice_cases pc ON pc.system_id = s.id
       LEFT JOIN test_answers ta ON ta.case_id = pc.id AND ta.user_id = ?
       GROUP BY s.id, s.name, s.slug, s.display_order
       ORDER BY s.display_order ASC`,
      [userId]
    );

    return rows.map((r) => {
      const attempted = Number(r.attempted) || 0;
      const correct = Number(r.correct) || 0;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        attempted,
        correct,
        accuracy: attempted > 0 ? Number(((correct / attempted) * 100).toFixed(1)) : null,
      };
    });
  },

  async getTestHistory(userId, limit = 50) {
    const [rows] = await pool.query(
      `SELECT ta.id, ta.score, ta.total_questions, ta.accuracy, ta.completed_at,
              t.block_number, t.title
       FROM test_attempts ta
       JOIN tests t ON t.id = ta.test_id
       WHERE ta.user_id = ? AND ta.status = 'completed'
       ORDER BY ta.completed_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  },
};

module.exports = progressModel;
