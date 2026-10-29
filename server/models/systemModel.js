const { pool } = require('../config/db');
const cache = require('../utils/cache');

const systemModel = {
  /**
   * Returns all 11 systems in display order, each with a live count of
   * published practice cases. Cached in RAM and invalidated on content edits.
   */
  async findAllWithCaseCounts() {
    return cache.getOrSet('systems:allWithCounts', 120000, async () => {
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
    });
  },

  async findBySlug(slug) {
    return cache.getOrSet(`systems:slug:${slug}`, 300000, async () => {
      const [rows] = await pool.query('SELECT * FROM systems WHERE slug = ? LIMIT 1', [slug]);
      return rows[0] || null;
    });
  },
};

module.exports = systemModel;
