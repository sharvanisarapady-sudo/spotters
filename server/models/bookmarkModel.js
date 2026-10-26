const { pool } = require('../config/db');

const bookmarkModel = {
  async add(userId, caseId) {
    await pool.query(
      `INSERT INTO bookmarks (user_id, case_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId, caseId]
    );
  },

  async remove(userId, caseId) {
    await pool.query('DELETE FROM bookmarks WHERE user_id = ? AND case_id = ?', [userId, caseId]);
  },

  async caseExists(caseId) {
    const [rows] = await pool.query(
      `SELECT id FROM practice_cases WHERE id = ? AND status = 'published' LIMIT 1`,
      [caseId]
    );
    return rows.length > 0;
  },

  /**
   * A student's bookmarked cases with enough info to render a
   * bookmarks list (used by the Progress/Bookmarks section).
   * Returns [] until anything is bookmarked.
   */
  async listForUser(userId) {
    const [rows] = await pool.query(
      `SELECT pc.id, pc.title, pc.modality, pc.difficulty,
              s.name AS system_name, s.slug AS system_slug,
              b.created_at AS bookmarked_at,
              (SELECT ci.image_url FROM case_images ci
                WHERE ci.case_id = pc.id
                ORDER BY ci.display_order ASC LIMIT 1) AS thumbnail_url
       FROM bookmarks b
       JOIN practice_cases pc ON pc.id = b.case_id AND pc.status = 'published'
       JOIN systems s ON s.id = pc.system_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return rows;
  },
};

module.exports = bookmarkModel;
