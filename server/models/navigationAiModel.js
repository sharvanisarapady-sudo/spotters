const { pool } = require('../config/db');
const cache = require('../utils/cache');

const navigationAiModel = {
  /**
   * Cases that can be used in AI Case Mentor: published AND carrying an answer key.
   */
  async listCases() {
    return cache.getOrSet('navai:cases', 120000, async () => {
      const [rows] = await pool.query(
        `SELECT pc.id, pc.modality, pc.difficulty,
                s.id AS system_id, s.name AS system_name, s.slug AS system_slug,
                (SELECT ci.image_url FROM case_images ci
                  WHERE ci.case_id = pc.id
                  ORDER BY ci.display_order ASC LIMIT 1) AS thumbnail_url
         FROM practice_cases pc
         JOIN systems s ON s.id = pc.system_id
         WHERE pc.status = 'published'
           AND pc.correct_answer IS NOT NULL AND TRIM(pc.correct_answer) <> ''
         ORDER BY pc.id ASC`
      );
      return rows.map((row, idx) => ({
        ...row,
        case_number: idx + 1,
        title: `Case ${idx + 1}`,
      }));
    });
  },

  /** Student-safe case: NO answer, explanation, findings, learning points or differentials. */
  async getCaseForStudent(caseId) {
    return cache.getOrSet(`navai:case:${caseId}`, 120000, async () => {
      const [[allIds], [rows], [images]] = await Promise.all([
        pool.query(
          `SELECT pc.id
           FROM practice_cases pc
           WHERE pc.status = 'published'
             AND pc.correct_answer IS NOT NULL AND TRIM(pc.correct_answer) <> ''
           ORDER BY pc.id ASC`
        ),
        pool.query(
          `SELECT pc.id, pc.modality, pc.difficulty, pc.clinical_info, pc.question_text,
                  s.name AS system_name, s.slug AS system_slug
           FROM practice_cases pc
           JOIN systems s ON s.id = pc.system_id
           WHERE pc.id = ? AND pc.status = 'published'
             AND pc.correct_answer IS NOT NULL AND TRIM(pc.correct_answer) <> ''
           LIMIT 1`,
          [caseId]
        ),
        pool.query(
          'SELECT id, image_url, display_order FROM case_images WHERE case_id = ? ORDER BY display_order ASC',
          [caseId]
        ),
      ]);
      if (!rows[0]) return null;

      const idx = allIds.findIndex((r) => Number(r.id) === Number(caseId));
      const caseNumber = idx >= 0 ? idx + 1 : Number(caseId);
      return {
        ...rows[0],
        case_number: caseNumber,
        title: `Case ${caseNumber}`,
        images,
      };
    });
  },

  /** Full row + system name + primary scan URL, server-side only, for AI evaluation. */
  async getCaseForAnalysis(caseId) {
    return cache.getOrSet(`navai:analysis:${caseId}`, 120000, async () => {
      const [rows] = await pool.query(
        `SELECT pc.*, s.name AS system_name, s.slug AS system_slug,
                (SELECT ci.image_url FROM case_images ci
                  WHERE ci.case_id = pc.id
                  ORDER BY ci.display_order ASC LIMIT 1) AS primary_image_url
         FROM practice_cases pc
         JOIN systems s ON s.id = pc.system_id
         WHERE pc.id = ? AND pc.status = 'published'
         LIMIT 1`,
        [caseId]
      );
      return rows[0] || null;
    });
  },

  async getVideos(caseId) {
    return cache.getOrSet(`navai:videos:${caseId}`, 120000, async () => {
      const [rows] = await pool.query(
        'SELECT id, video_url, title FROM case_videos WHERE case_id = ? AND video_url IS NOT NULL ORDER BY id ASC',
        [caseId]
      );
      return rows;
    });
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
