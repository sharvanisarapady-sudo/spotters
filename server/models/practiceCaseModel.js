const { pool } = require('../config/db');

const practiceCaseModel = {
  /**
   * Published cases for one system, newest first. Each row includes
   * a thumbnail (first image, if any) and whether the current user
   * has bookmarked it. Returns [] until cases are added.
   */
  async findBySystemSlug(systemSlug, userId) {
    const [rows] = await pool.query(
      `SELECT pc.id, pc.title, pc.modality, pc.difficulty, pc.created_at,
              (SELECT ci.image_url FROM case_images ci
                WHERE ci.case_id = pc.id
                ORDER BY ci.display_order ASC LIMIT 1) AS thumbnail_url,
              EXISTS(
                SELECT 1 FROM bookmarks b WHERE b.case_id = pc.id AND b.user_id = ?
              ) AS is_bookmarked
       FROM practice_cases pc
       JOIN systems s ON s.id = pc.system_id
       WHERE s.slug = ? AND pc.status = 'published'
       ORDER BY pc.created_at DESC`,
      [userId, systemSlug]
    );
    return rows;
  },

  /**
   * Full case detail for the case page: clinical info, diagnosis,
   * explanation, findings, learning points, differentials, images,
   * and this user's bookmark status. Only published cases are
   * returned to students.
   */
  async findByIdForStudent(caseId, userId) {
    const [[rows], [images], [videos]] = await Promise.all([
      pool.query(
        `SELECT pc.id, pc.title, pc.modality, pc.difficulty,
                pc.clinical_info, pc.question_text, pc.correct_answer,
                pc.explanation, pc.key_findings, pc.learning_points,
                pc.differential_diagnosis, pc.created_at,
                s.id AS system_id, s.name AS system_name, s.slug AS system_slug,
                EXISTS(
                  SELECT 1 FROM bookmarks b WHERE b.case_id = pc.id AND b.user_id = ?
                ) AS is_bookmarked
         FROM practice_cases pc
         JOIN systems s ON s.id = pc.system_id
         WHERE pc.id = ? AND pc.status = 'published'
         LIMIT 1`,
        [userId, caseId]
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
    const caseRow = rows[0];
    if (!caseRow) return null;

    return { ...caseRow, images, videos };
  },
};

module.exports = practiceCaseModel;
