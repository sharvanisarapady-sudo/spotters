const { pool } = require('../config/db');

const systemModel = {
  /**
   * Returns all 11 systems in display order, each with a live count of
   * published practice cases (0 until cases are added later).
   */
  async findAllWithCaseCounts() {
    const [rows] = await pool.query(
      `SELECT s.id, s.name, s.slug, s.display_order,
              COUNT(pc.id) AS case_count
       FROM systems s
       LEFT JOIN practice_cases pc
              ON pc.system_id = s.id AND pc.status = 'published'
       GROUP BY s.id, s.name, s.slug, s.display_order
       ORDER BY s.display_order ASC`
    );
    return rows;
  },

  async findBySlug(slug) {
    const [rows] = await pool.query('SELECT * FROM systems WHERE slug = ? LIMIT 1', [slug]);
    return rows[0] || null;
  },
};

module.exports = systemModel;
