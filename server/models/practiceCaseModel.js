const { pool } = require('../config/db');
const cache = require('../utils/cache');

const practiceCaseModel = {
  /**
   * Published cases for one system, newest first.
   */
  async findBySystemSlug(systemSlug, userId) {
    const [baseCases, [bookmarks]] = await Promise.all([
      cache.getOrSet(`practice:system:${systemSlug}`, 120000, async () => {
        const [rows] = await pool.query(
          `SELECT pc.id, pc.title, pc.modality, pc.difficulty, pc.created_at,
                  (SELECT ci.image_url FROM case_images ci
                    WHERE ci.case_id = pc.id
                    ORDER BY ci.display_order ASC LIMIT 1) AS thumbnail_url
           FROM practice_cases pc
           JOIN systems s ON s.id = pc.system_id
           WHERE s.slug = ? AND pc.status = 'published'
           ORDER BY pc.created_at DESC`,
          [systemSlug]
        );
        return rows;
      }),
      pool.query('SELECT case_id FROM bookmarks WHERE user_id = ?', [userId]),
    ]);

    const bookmarkedSet = new Set(bookmarks.map((b) => Number(b.case_id)));
    return baseCases.map((c) => ({
      ...c,
      is_bookmarked: bookmarkedSet.has(Number(c.id)) ? 1 : 0,
    }));
  },

  /**
   * Full case detail for the case page (base content cached in RAM; bookmark checked swiftly).
   */
  async findByIdForStudent(caseId, userId) {
    const [baseCase, [bm]] = await Promise.all([
      cache.getOrSet(`practice:case:${caseId}`, 120000, async () => {
        const [[rows], [images], [videos]] = await Promise.all([
          pool.query(
            `SELECT pc.id, pc.title, pc.modality, pc.difficulty,
                    pc.clinical_info, pc.question_text, pc.correct_answer,
                    pc.explanation, pc.key_findings, pc.learning_points,
                    pc.differential_diagnosis, pc.created_at,
                    s.id AS system_id, s.name AS system_name, s.slug AS system_slug
             FROM practice_cases pc
             JOIN systems s ON s.id = pc.system_id
             WHERE pc.id = ? AND pc.status = 'published'
             LIMIT 1`,
            [caseId]
          ),
          pool.query(
            `SELECT id, image_url, display_order FROM case_images WHERE case_id = ? ORDER BY display_order ASC`,
            [caseId]
          ),
          pool.query(
            `SELECT id, video_url, title FROM case_videos WHERE case_id = ? AND video_url IS NOT NULL ORDER BY id ASC`,
            [caseId]
          ),
        ]);
        if (!rows[0]) return null;
        return { ...rows[0], images, videos };
      }),
      pool.query('SELECT 1 AS ok FROM bookmarks WHERE case_id = ? AND user_id = ? LIMIT 1', [caseId, userId]),
    ]);

    if (!baseCase) return null;
    return {
      ...baseCase,
      is_bookmarked: bm.length > 0 ? 1 : 0,
    };
  },
};

module.exports = practiceCaseModel;
