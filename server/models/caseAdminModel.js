const { pool } = require('../config/db');

const FIELDS = [
  'system_id', 'title', 'modality', 'difficulty', 'clinical_info', 'question_text',
  'correct_answer', 'explanation', 'key_findings', 'learning_points', 'differential_diagnosis',
];

const caseAdminModel = {
  async list({ status, systemId }) {
    const where = [];
    const params = [];
    if (status) { where.push('pc.status = ?'); params.push(status); }
    if (systemId) { where.push('pc.system_id = ?'); params.push(systemId); }
    const [rows] = await pool.query(
      `SELECT pc.id, pc.title, pc.modality, pc.difficulty, pc.status, pc.created_at,
              s.name AS system_name,
              (SELECT COUNT(*) FROM case_images ci WHERE ci.case_id = pc.id) AS image_count
       FROM practice_cases pc JOIN systems s ON s.id = pc.system_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY pc.created_at DESC`,
      params
    );
    return rows;
  },

  async get(id) {
    const [rows] = await pool.query('SELECT * FROM practice_cases WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return null;
    const [images] = await pool.query('SELECT id, image_url, display_order FROM case_images WHERE case_id = ? ORDER BY display_order', [id]);
    const [videos] = await pool.query('SELECT id, video_url, title FROM case_videos WHERE case_id = ? ORDER BY id', [id]);
    return { ...rows[0], images, videos };
  },

  async create(data, userId) {
    const cols = FIELDS.filter((f) => data[f] !== undefined);
    const [r] = await pool.query(
      `INSERT INTO practice_cases (${cols.join(',')}, status, created_by) VALUES (${cols.map(() => '?').join(',')}, 'draft', ?)`,
      [...cols.map((c) => data[c]), userId]
    );
    return r.insertId;
  },

  async update(id, data) {
    const cols = FIELDS.filter((f) => data[f] !== undefined);
    if (!cols.length) return;
    await pool.query(`UPDATE practice_cases SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`, [...cols.map((c) => data[c]), id]);
  },

  async setStatus(id, status) {
    const [r] = await pool.query('UPDATE practice_cases SET status = ? WHERE id = ?', [status, id]);
    return r.affectedRows > 0;
  },

  async remove(id) {
    const [r] = await pool.query('DELETE FROM practice_cases WHERE id = ?', [id]);
    return r.affectedRows > 0;
  },

  async addImage(caseId, url) {
    const [[m]] = await pool.query('SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM case_images WHERE case_id = ?', [caseId]);
    const [r] = await pool.query('INSERT INTO case_images (case_id, image_url, display_order) VALUES (?, ?, ?)', [caseId, url, m.next]);
    return r.insertId;
  },
  /** Inserts several images atomically; either all rows are saved or none. */
  async addImages(caseId, urls) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[m]] = await conn.query('SELECT COALESCE(MAX(display_order), 0) AS max FROM case_images WHERE case_id = ?', [caseId]);
      const ids = [];
      for (let i = 0; i < urls.length; i += 1) {
        const [r] = await conn.query('INSERT INTO case_images (case_id, image_url, display_order) VALUES (?, ?, ?)', [caseId, urls[i], m.max + i + 1]);
        ids.push(r.insertId);
      }
      await conn.commit();
      return ids.map((id, i) => ({ id, image_url: urls[i], display_order: m.max + i + 1 }));
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },
  async caseExists(id) {
    const [rows] = await pool.query('SELECT id FROM practice_cases WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0;
  },
  async getImage(id) {
    const [rows] = await pool.query('SELECT id, case_id, image_url FROM case_images WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },
  async listImageUrlsForCase(caseId) {
    const [rows] = await pool.query('SELECT image_url FROM case_images WHERE case_id = ?', [caseId]);
    return rows.map((r) => r.image_url);
  },
  async removeImage(id) {
    const [r] = await pool.query('DELETE FROM case_images WHERE id = ?', [id]);
    return r.affectedRows > 0;
  },
  async addVideo(caseId, url, title) {
    const [r] = await pool.query('INSERT INTO case_videos (case_id, video_url, title) VALUES (?, ?, ?)', [caseId, url, title || null]);
    return r.insertId;
  },
  async removeVideo(id) {
    const [r] = await pool.query('DELETE FROM case_videos WHERE id = ?', [id]);
    return r.affectedRows > 0;
  },

  /** All blocks with their assigned questions (case title/status) for the admin UI. */
  async listBlocksWithQuestions() {
    const [blocks] = await pool.query('SELECT id, block_number, title, total_questions, is_active FROM tests ORDER BY block_number');
    const [qs] = await pool.query(
      `SELECT tq.id, tq.test_id, tq.case_id, tq.question_order, pc.title, pc.status,
              (SELECT COUNT(*) FROM test_answers ta WHERE ta.question_id = tq.id) AS answer_count
       FROM test_questions tq JOIN practice_cases pc ON pc.id = tq.case_id
       ORDER BY tq.test_id, tq.question_order`
    );
    return blocks.map((b) => ({ ...b, questions: qs.filter((q) => q.test_id === b.id) }));
  },

  /**
   * Adds ONE case to a block (non-destructive; existing questions/answers untouched).
   * Returns {ok:true,id} or {ok:false,code}: block_not_found | case_not_found | not_published
   * | no_answer_key | duplicate | block_full
   */
  async addTestQuestion(testId, caseId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[test]] = await conn.query('SELECT id, total_questions FROM tests WHERE id = ? FOR UPDATE', [testId]);
      if (!test) { await conn.rollback(); return { ok: false, code: 'block_not_found' }; }
      const [[pc]] = await conn.query('SELECT id, status, correct_answer FROM practice_cases WHERE id = ?', [caseId]);
      if (!pc) { await conn.rollback(); return { ok: false, code: 'case_not_found' }; }
      if (pc.status !== 'published') { await conn.rollback(); return { ok: false, code: 'not_published' }; }
      if (!pc.correct_answer || !pc.correct_answer.trim()) { await conn.rollback(); return { ok: false, code: 'no_answer_key' }; }
      const [existing] = await conn.query('SELECT case_id, question_order FROM test_questions WHERE test_id = ?', [testId]);
      if (existing.some((q) => q.case_id === Number(caseId))) { await conn.rollback(); return { ok: false, code: 'duplicate' }; }
      const used = new Set(existing.map((q) => q.question_order));
      let order = 1;
      while (used.has(order)) order += 1;
      if (order > test.total_questions) { await conn.rollback(); return { ok: false, code: 'block_full' }; }
      const [r] = await conn.query('INSERT INTO test_questions (test_id, case_id, question_order) VALUES (?, ?, ?)', [testId, caseId, order]);
      await conn.commit();
      return { ok: true, id: r.insertId, question_order: order };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  /** Removes a question only if nobody has answered it (answers cascade-delete otherwise). */
  async removeTestQuestion(testId, questionId) {
    const [[row]] = await pool.query(
      `SELECT tq.id, (SELECT COUNT(*) FROM test_answers ta WHERE ta.question_id = tq.id) AS answers
       FROM test_questions tq WHERE tq.id = ? AND tq.test_id = ?`,
      [questionId, testId]
    );
    if (!row) return { ok: false, code: 'not_found' };
    if (row.answers > 0) return { ok: false, code: 'has_answers' };
    await pool.query('DELETE FROM test_questions WHERE id = ?', [questionId]);
    return { ok: true };
  },

  /** Replace the ordered question list of a test block. */
  async setTestQuestions(testId, caseIds) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM test_questions WHERE test_id = ?', [testId]);
      for (let i = 0; i < caseIds.length; i += 1) {
        await conn.query('INSERT INTO test_questions (test_id, case_id, question_order) VALUES (?, ?, ?)', [testId, caseIds[i], i + 1]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },
};

module.exports = caseAdminModel;
