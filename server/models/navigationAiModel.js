const { pool } = require('../config/db');

const navigationAiModel = {
  /**
   * Cases that can be used in Navigation AI: published AND carrying an answer
   * key (otherwise there is nothing to evaluate against). Returns [] until
   * cases are added.
   */
  async listCases() {
    const [rows] = await pool.query(
      `SELECT pc.id, pc.title, pc.modality, pc.difficulty,
              s.id AS system_id, s.name AS system_name, s.slug AS system_slug,
              (SELECT ci.image_url FROM case_images ci
                WHERE ci.case_id = pc.id
                ORDER BY ci.display_order ASC LIMIT 1) AS thumbnail_url
       FROM practice_cases pc
       JOIN systems s ON s.id = pc.system_id
       WHERE pc.status = 'published'
         AND pc.correct_answer IS NOT NULL AND TRIM(pc.correct_answer) <> ''
       ORDER BY s.display_order ASC, pc.created_at DESC`
    );
    return rows;
  },

  /** Student-safe case: NO answer, explanation, findings, learning points or differentials. */
  async getCaseForStudent(caseId) {
    const [rows] = await pool.query(
      `SELECT pc.id, pc.title, pc.modality, pc.difficulty, pc.clinical_info, pc.question_text,
              s.name AS system_name, s.slug AS system_slug
       FROM practice_cases pc
       JOIN systems s ON s.id = pc.system_id
       WHERE pc.id = ? AND pc.status = 'published'
         AND pc.correct_answer IS NOT NULL AND TRIM(pc.correct_answer) <> ''
       LIMIT 1`,
      [caseId]
    );
    if (!rows[0]) return null;

    const [images] = await pool.query(
      'SELECT id, image_url, display_order FROM case_images WHERE case_id = ? ORDER BY display_order ASC',
      [caseId]
    );
    return { ...rows[0], images };
  },

  /** Full row, server-side only, for evaluation. */
  async getCaseForAnalysis(caseId) {
    const [rows] = await pool.query(
      `SELECT * FROM practice_cases WHERE id = ? AND status = 'published' LIMIT 1`,
      [caseId]
    );
    return rows[0] || null;
  },

  async getVideos(caseId) {
    const [rows] = await pool.query(
      'SELECT id, video_url, title FROM case_videos WHERE case_id = ? AND video_url IS NOT NULL ORDER BY id ASC',
      [caseId]
    );
    return rows;
  },

  async logInteraction({ userId, caseId, inputMethod, studentAnswer, verdict, response }) {
    await pool.query(
      `INSERT INTO ai_interactions (user_id, case_id, input_method, student_answer, ai_verdict, ai_response)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, caseId, inputMethod, studentAnswer, verdict, JSON.stringify(response)]
    );
  },
};

module.exports = navigationAiModel;
