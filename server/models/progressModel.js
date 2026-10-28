const { pool } = require('../config/db');
const { displayAnswer } = require('../services/answerEvaluationService');

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

  /** Detailed list of all questions attempted by the user across all attempts. */
  async getAttemptedQuestions(userId) {
    const [rows] = await pool.query(
      `SELECT ta.id, ta.attempt_id, ta.test_id, ta.question_id, ta.case_id,
              ta.student_answer, ta.is_correct, ta.time_taken_seconds, ta.answered_at,
              t.block_number, t.title AS block_title,
              tq.question_order,
              pc.title AS case_title, pc.modality, pc.correct_answer,
              s.name AS system_name
       FROM test_answers ta
       JOIN tests t ON t.id = ta.test_id
       LEFT JOIN test_questions tq ON tq.id = ta.question_id
       JOIN practice_cases pc ON pc.id = ta.case_id
       JOIN systems s ON s.id = pc.system_id
       WHERE ta.user_id = ?
       ORDER BY ta.answered_at DESC, ta.id DESC`,
      [userId]
    );
    return rows.map((r) => ({
      ...r,
      is_correct: r.is_correct === null ? null : Number(r.is_correct),
      correct_answer: displayAnswer(r.correct_answer),
    }));
  },

  /** Per-block progress summary and the questions attempted inside each block. */
  async getBlockProgress(userId) {
    const [blocks] = await pool.query(
      `SELECT t.id, t.block_number, t.title,
              (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id) AS question_count,
              (SELECT COUNT(*) FROM test_attempts att WHERE att.test_id = t.id AND att.user_id = ? AND att.status = 'completed') AS tests_completed
       FROM tests t
       ORDER BY t.block_number ASC`,
      [userId]
    );

    const attempted = await this.getAttemptedQuestions(userId);

    return blocks.map((b) => {
      const bQuestions = attempted.filter((q) => Number(q.test_id) === Number(b.id));
      const totalAttempted = bQuestions.length;
      const gradedCount = bQuestions.filter((q) => q.is_correct !== null).length;
      const correctCount = bQuestions.filter((q) => q.is_correct === 1).length;
      return {
        id: b.id,
        block_number: b.block_number,
        title: b.title,
        question_count: Number(b.question_count) || 0,
        tests_completed: Number(b.tests_completed) || 0,
        questions_attempted: totalAttempted,
        correct_answers: correctCount,
        accuracy: gradedCount > 0 ? Number(((correctCount / gradedCount) * 100).toFixed(1)) : null,
        questions: bQuestions,
      };
    });
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

  /** All distinct cases the user has ever answered wrong, most-recent first. */
  async getWrongAnswers(userId) {
    const [rows] = await pool.query(
      `SELECT DISTINCT ta.case_id,
              pc.title, pc.modality, pc.difficulty, pc.clinical_info,
              pc.question_text, pc.correct_answer, pc.explanation,
              MAX(ta.answered_at) AS last_answered_at,
              SUM(CASE WHEN ta.is_correct = 0 THEN 1 ELSE 0 END) AS times_wrong
       FROM test_answers ta
       JOIN practice_cases pc ON pc.id = ta.case_id
       WHERE ta.user_id = ? AND ta.is_correct = 0
       GROUP BY ta.case_id, pc.title, pc.modality, pc.difficulty,
                pc.clinical_info, pc.question_text, pc.correct_answer, pc.explanation
       ORDER BY MAX(ta.answered_at) DESC`,
      [userId]
    );
    for (const r of rows) {
      const [images] = await pool.query(
        'SELECT id, image_url, display_order FROM case_images WHERE case_id = ? ORDER BY display_order ASC',
        [r.case_id]
      );
      r.images = images;
    }
    return rows;
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

  /** Active days, today's activity summary, today's feed, and 7-day trend series. */
  async getActivityStats(userId) {
    const [activeDates] = await pool.query(
      `SELECT DISTINCT d FROM (
         SELECT DATE(started_at) AS d FROM test_attempts WHERE user_id = ?
         UNION
         SELECT DATE(answered_at) AS d FROM test_answers WHERE user_id = ?
         UNION
         SELECT DATE(created_at) AS d FROM ai_interactions WHERE user_id = ?
         UNION
         SELECT DATE(created_at) AS d FROM study_planner WHERE user_id = ? AND is_completed = 1
         UNION
         SELECT CURDATE() AS d
       ) AS dates WHERE d IS NOT NULL`,
      [userId, userId, userId, userId]
    );

    const [[todayAns]] = await pool.query(
      `SELECT COUNT(*) AS attempted,
              SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM test_answers
       WHERE user_id = ? AND DATE(answered_at) = CURDATE()`,
      [userId]
    );

    const [[todayTests]] = await pool.query(
      `SELECT COUNT(*) AS completed
       FROM test_attempts
       WHERE user_id = ? AND status = 'completed' AND DATE(completed_at) = CURDATE()`,
      [userId]
    );

    const [[todayAi]] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM ai_interactions
       WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [userId]
    );

    const [[todayPlanner]] = await pool.query(
      `SELECT COUNT(*) AS completed,
              (SELECT COUNT(*) FROM study_planner WHERE user_id = ? AND scheduled_date = CURDATE()) AS total
       FROM study_planner
       WHERE user_id = ? AND scheduled_date = CURDATE() AND is_completed = 1`,
      [userId, userId]
    );

    // Recent activities today / recent days
    const [recentAnswers] = await pool.query(
      `SELECT ta.id, ta.is_correct, ta.answered_at AS ts,
              pc.title AS case_title, pc.modality, t.block_number
       FROM test_answers ta
       JOIN practice_cases pc ON pc.id = ta.case_id
       JOIN tests t ON t.id = ta.test_id
       WHERE ta.user_id = ?
       ORDER BY ta.answered_at DESC LIMIT 8`,
      [userId]
    );

    const [recentAi] = await pool.query(
      `SELECT ai.id, ai.ai_verdict, ai.created_at AS ts, pc.modality, pc.id AS case_id
       FROM ai_interactions ai
       LEFT JOIN practice_cases pc ON pc.id = ai.case_id
       WHERE ai.user_id = ?
       ORDER BY ai.created_at DESC LIMIT 5`,
      [userId]
    );

    const feed = [
      ...recentAnswers.map((a) => ({
        id: `ans-${a.id}`,
        type: 'question',
        label: `Attempted "${a.case_title}" in Block ${a.block_number}`,
        badge: a.is_correct === 1 ? 'Correct' : 'Incorrect',
        badgeTone: a.is_correct === 1 ? 'green' : 'red',
        ts: a.ts,
      })),
      ...recentAi.map((a) => ({
        id: `ai-${a.id}`,
        type: 'ai',
        label: `Practiced Navigation AI Case #${a.case_id || ''}`,
        badge: a.ai_verdict === 'correct' ? 'AI Verified' : 'Reviewed',
        badgeTone: a.ai_verdict === 'correct' ? 'green' : 'blue',
        ts: a.ts,
      })),
    ]
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 8);

    // 7-day trend series for charts
    const [dailyRows] = await pool.query(
      `SELECT DATE(answered_at) AS d,
              COUNT(*) AS attempted,
              SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM test_answers
       WHERE user_id = ? AND answered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(answered_at)
       ORDER BY d ASC`,
      [userId]
    );

    const byDate = new Map(dailyRows.map((r) => [String(r.d).slice(0, 10), r]));
    const dailySeries = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const iso = dt.toISOString().slice(0, 10);
      const label = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const row = byDate.get(iso);
      dailySeries.push({
        date: iso,
        label,
        attempted: row ? Number(row.attempted) : 0,
        correct: row ? Number(row.correct) : 0,
      });
    }

    return {
      activeDays: Math.max(activeDates.length, 1),
      todaySummary: {
        questionsToday: Number(todayAns.attempted) || 0,
        correctToday: Number(todayAns.correct) || 0,
        testsCompletedToday: Number(todayTests.completed) || 0,
        aiInteractionsToday: Number(todayAi.count) || 0,
        plannerCompletedToday: Number(todayPlanner.completed) || 0,
        plannerTotalToday: Number(todayPlanner.total) || 0,
      },
      todayFeed: feed,
      dailySeries,
    };
  },

  /** Daily Planner & Lesson Schedule methods */
  async getPlannerTasks(userId) {
    const [existing] = await pool.query(
      'SELECT * FROM study_planner WHERE user_id = ? ORDER BY scheduled_date ASC, is_completed ASC, id ASC',
      [userId]
    );
    if (existing.length > 0) return existing;

    // Seed 3 starter schedule items for a new user so their daily planner is ready out of the box
    const defaults = [
      ['Neuroradiology MRI Slice Review', 'Neuroradiology', 'lesson', '09:00 AM', 30],
      ['Cardiothoracic Chest X-Ray Practice', 'Cardiothoracic', 'practice', '02:00 PM', 25],
      ['Complete Block 1 Timed Spotter Assessment', 'All Systems', 'test', '06:00 PM', 15],
    ];
    for (const [title, sys, type, time, mins] of defaults) {
      await pool.query(
        `INSERT INTO study_planner (user_id, title, system_name, task_type, scheduled_date, scheduled_time, duration_minutes, is_completed)
         VALUES (?, ?, ?, ?, CURDATE(), ?, ?, 0)`,
        [userId, title, sys, type, time, mins]
      );
    }
    const [seeded] = await pool.query(
      'SELECT * FROM study_planner WHERE user_id = ? ORDER BY scheduled_date ASC, is_completed ASC, id ASC',
      [userId]
    );
    return seeded;
  },

  async addPlannerTask(userId, { title, system_name, task_type = 'lesson', scheduled_date, scheduled_time, duration_minutes = 30 }) {
    const dateVal = scheduled_date || new Date().toISOString().slice(0, 10);
    const [r] = await pool.query(
      `INSERT INTO study_planner (user_id, title, system_name, task_type, scheduled_date, scheduled_time, duration_minutes, is_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        userId,
        title.trim(),
        system_name || 'General Radiology',
        ['lesson', 'practice', 'test', 'revision'].includes(task_type) ? task_type : 'lesson',
        dateVal,
        scheduled_time || '10:00 AM',
        Number(duration_minutes) > 0 ? Number(duration_minutes) : 30,
      ]
    );
    const [[row]] = await pool.query('SELECT * FROM study_planner WHERE id = ?', [r.insertId]);
    return row;
  },

  async togglePlannerTask(userId, taskId) {
    await pool.query(
      'UPDATE study_planner SET is_completed = NOT is_completed WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );
    const [[row]] = await pool.query('SELECT * FROM study_planner WHERE id = ? AND user_id = ?', [taskId, userId]);
    return row || null;
  },

  async deletePlannerTask(userId, taskId) {
    const [r] = await pool.query('DELETE FROM study_planner WHERE id = ? AND user_id = ?', [taskId, userId]);
    return r.affectedRows > 0;
  },
};

module.exports = progressModel;
