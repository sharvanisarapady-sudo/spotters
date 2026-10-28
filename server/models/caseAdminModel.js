const { pool } = require('../config/db');

const FIELDS = [
  'system_id', 'title', 'modality', 'difficulty', 'clinical_info', 'question_text',
  'correct_answer', 'explanation', 'key_findings', 'learning_points', 'differential_diagnosis',
];

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let settingsTableReady = false;
async function ensureSettingsTable(conn) {
  if (settingsTableReady) return;
  await conn.query(
    `CREATE TABLE IF NOT EXISTS app_settings (
       setting_key VARCHAR(64) PRIMARY KEY,
       setting_value VARCHAR(255) NOT NULL
     ) ENGINE=InnoDB`
  );
  settingsTableReady = true;
}

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
    if (r.affectedRows > 0) {
      await caseAdminModel.autoSyncBlocks();
    }
    return r.affectedRows > 0;
  },

  async remove(id) {
    const [r] = await pool.query('DELETE FROM practice_cases WHERE id = ?', [id]);
    if (r.affectedRows > 0) {
      await caseAdminModel.autoSyncBlocks();
    }
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

  /**
   * Automatically ensures all published cases with answer keys are uniquely and randomly
   * assigned across test blocks. Creates new blocks (Block N+1, N+2, ...) automatically
   * whenever existing blocks reach capacity so block numbers can grow infinitely.
   */
  async autoSyncBlocks({ reshuffleAll = false, questionsPerBlock = null } = {}) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await ensureSettingsTable(conn);

      let capacity = 10;
      if (questionsPerBlock !== null && Number.isInteger(Number(questionsPerBlock)) && Number(questionsPerBlock) >= 1) {
        capacity = Math.min(100, Math.max(1, Number(questionsPerBlock)));
        await conn.query(
          `INSERT INTO app_settings (setting_key, setting_value) VALUES ('questions_per_block', ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [String(capacity)]
        );
      } else {
        const [settingRows] = await conn.query(
          `SELECT setting_value FROM app_settings WHERE setting_key = 'questions_per_block' LIMIT 1`
        );
        if (settingRows[0] && Number(settingRows[0].setting_value) >= 1) {
          capacity = Number(settingRows[0].setting_value);
        }
      }

      // 1. All valid published cases
      const [publishedRows] = await conn.query(
        `SELECT id FROM practice_cases
         WHERE status = 'published' AND correct_answer IS NOT NULL AND TRIM(correct_answer) <> ''
         ORDER BY id ASC`
      );
      const publishedIds = publishedRows.map((r) => r.id);
      const publishedSet = new Set(publishedIds);

      // 2. Ensure at least Block 1 exists
      let [blocks] = await conn.query(
        'SELECT id, block_number, seconds_per_question FROM tests ORDER BY block_number ASC FOR UPDATE'
      );
      if (blocks.length === 0) {
        const [ins] = await conn.query(
          `INSERT INTO tests (block_number, title, total_questions, seconds_per_question, is_active)
           VALUES (1, 'Block 1', ?, 60, 1)`,
          [capacity]
        );
        blocks = [{ id: ins.insertId, block_number: 1, seconds_per_question: 60 }];
      }

      // 3. Existing test_questions rows — remove unpublished or duplicate case assignments
      const [existingTq] = await conn.query(
        'SELECT id, test_id, case_id, question_order FROM test_questions ORDER BY test_id ASC, question_order ASC FOR UPDATE'
      );
      const seenCases = new Set();
      const validTqByCase = new Map();
      const duplicateOrUnpublishedTqIds = [];

      for (const row of existingTq) {
        if (!publishedSet.has(row.case_id) || seenCases.has(row.case_id)) {
          duplicateOrUnpublishedTqIds.push(row.id);
        } else {
          seenCases.add(row.case_id);
          validTqByCase.set(row.case_id, row);
        }
      }

      if (duplicateOrUnpublishedTqIds.length > 0) {
        await conn.query(
          `DELETE FROM test_questions WHERE id IN (${duplicateOrUnpublishedTqIds.map(() => '?').join(',')})`,
          duplicateOrUnpublishedTqIds
        );
      }

      if (reshuffleAll) {
        // Shuffle ALL published cases randomly and partition into blocks of size `capacity`
        const shuffledCaseIds = shuffleArray(publishedIds);
        const neededBlocks = Math.max(1, Math.ceil(shuffledCaseIds.length / capacity));

        while (blocks.length < neededBlocks) {
          const nextBlockNum = blocks[blocks.length - 1].block_number + 1;
          const [ins] = await conn.query(
            `INSERT INTO tests (block_number, title, total_questions, seconds_per_question, is_active)
             VALUES (?, ?, ?, 60, 1)`,
            [nextBlockNum, `Block ${nextBlockNum}`, capacity]
          );
          blocks.push({ id: ins.insertId, block_number: nextBlockNum, seconds_per_question: 60 });
        }

        // Temporarily offset question_order so UNIQUE(test_id, question_order) never collides during updates
        await conn.query('UPDATE test_questions SET question_order = id + 100000');

        for (let i = 0; i < shuffledCaseIds.length; i += 1) {
          const caseId = shuffledCaseIds[i];
          const blockIdx = Math.floor(i / capacity);
          const orderInBlock = (i % capacity) + 1;
          const targetTestId = blocks[blockIdx].id;

          const existingRow = validTqByCase.get(caseId);
          if (existingRow) {
            await conn.query(
              'UPDATE test_questions SET test_id = ?, question_order = ? WHERE id = ?',
              [targetTestId, orderInBlock, existingRow.id]
            );
          } else {
            await conn.query(
              'INSERT INTO test_questions (test_id, case_id, question_order) VALUES (?, ?, ?)',
              [targetTestId, caseId, orderInBlock]
            );
          }
        }
      } else {
        // Incremental mode: find any newly published cases not yet in any block
        const unassignedCaseIds = shuffleArray(publishedIds.filter((id) => !validTqByCase.has(id)));

        if (unassignedCaseIds.length > 0) {
          // Count current questions per block
          const blockCasesMap = new Map(blocks.map((b) => [b.id, []]));
          for (const row of validTqByCase.values()) {
            if (!blockCasesMap.has(row.test_id)) blockCasesMap.set(row.test_id, []);
            blockCasesMap.get(row.test_id).push(row);
          }

          const touchedBlockIds = new Set();

          for (const newCaseId of unassignedCaseIds) {
            // Find the first block that has fewer than `capacity` questions
            let targetBlock = blocks.find((b) => (blockCasesMap.get(b.id)?.length || 0) < capacity);

            // If all existing blocks are full, automatically create the next Block N+1
            if (!targetBlock) {
              const nextBlockNum = blocks[blocks.length - 1].block_number + 1;
              const [ins] = await conn.query(
                `INSERT INTO tests (block_number, title, total_questions, seconds_per_question, is_active)
                 VALUES (?, ?, ?, 60, 1)`,
                [nextBlockNum, `Block ${nextBlockNum}`, capacity]
              );
              targetBlock = { id: ins.insertId, block_number: nextBlockNum, seconds_per_question: 60 };
              blocks.push(targetBlock);
              blockCasesMap.set(targetBlock.id, []);
            }

            const currentList = blockCasesMap.get(targetBlock.id);
            const tempOrder = currentList.length + 50000;
            const [insTq] = await conn.query(
              'INSERT INTO test_questions (test_id, case_id, question_order) VALUES (?, ?, ?)',
              [targetBlock.id, newCaseId, tempOrder]
            );
            currentList.push({ id: insTq.insertId, test_id: targetBlock.id, case_id: newCaseId, question_order: tempOrder });
            touchedBlockIds.add(targetBlock.id);
          }

          // Randomly shuffle question_order within each block that received new cases
          for (const blockId of touchedBlockIds) {
            const list = blockCasesMap.get(blockId) || [];
            await conn.query('UPDATE test_questions SET question_order = id + 100000 WHERE test_id = ?', [blockId]);
            const shuffledList = shuffleArray(list);
            for (let idx = 0; idx < shuffledList.length; idx += 1) {
              await conn.query(
                'UPDATE test_questions SET question_order = ? WHERE id = ?',
                [idx + 1, shuffledList[idx].id]
              );
            }
          }
        }
      }

      // 4. Sync total_questions on all blocks
      const [counts] = await conn.query(
        `SELECT t.id, COUNT(tq.id) AS cnt
         FROM tests t
         LEFT JOIN test_questions tq ON tq.test_id = t.id
         GROUP BY t.id`
      );
      for (const c of counts) {
        await conn.query('UPDATE tests SET total_questions = ? WHERE id = ?', [Math.max(c.cnt, 1), c.id]);
      }

      await conn.commit();
      return { questionsPerBlock: capacity };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  /** All blocks with their assigned questions (case title/status) for the admin UI. */
  async listBlocksWithQuestions() {
    const { questionsPerBlock } = await caseAdminModel.autoSyncBlocks();
    const [blocks] = await pool.query('SELECT id, block_number, title, total_questions, seconds_per_question, is_active FROM tests ORDER BY block_number');
    const [qs] = await pool.query(
      `SELECT tq.id, tq.test_id, tq.case_id, tq.question_order, pc.title, pc.status, pc.modality,
              s.name AS system_name,
              (SELECT COUNT(*) FROM test_answers ta WHERE ta.question_id = tq.id) AS answer_count
       FROM test_questions tq
       JOIN practice_cases pc ON pc.id = tq.case_id
       JOIN systems s ON s.id = pc.system_id
       ORDER BY tq.test_id, tq.question_order`
    );
    return {
      questionsPerBlock,
      blocks: blocks.map((b) => ({ ...b, questions: qs.filter((q) => q.test_id === b.id) })),
    };
  },

  /** Creates a new test block (auto-assigns the next block_number if not provided). */
  async createBlock({ blockNumber, title, secondsPerQuestion = 60 } = {}) {
    let nextNum = Number(blockNumber);
    if (!Number.isInteger(nextNum) || nextNum < 1) {
      const [[row]] = await pool.query('SELECT COALESCE(MAX(block_number), 0) + 1 AS next FROM tests');
      nextNum = row.next;
    }
    const blockTitle = (title && title.trim()) || `Block ${nextNum}`;
    const secs = Number(secondsPerQuestion) > 0 ? Number(secondsPerQuestion) : 60;
    const [r] = await pool.query(
      'INSERT INTO tests (block_number, title, total_questions, seconds_per_question, is_active) VALUES (?, ?, 20, ?, 1)',
      [nextNum, blockTitle, secs]
    );
    return { id: r.insertId, block_number: nextNum, title: blockTitle, seconds_per_question: secs };
  },

  /** Deletes a test block by id. */
  async deleteBlock(testId) {
    const [r] = await pool.query('DELETE FROM tests WHERE id = ?', [testId]);
    return r.affectedRows > 0;
  },

  /**
   * Adds ONE case to a block (non-destructive; existing questions/answers untouched).
   * Automatically expands total_questions if needed.
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
      const [r] = await conn.query('INSERT INTO test_questions (test_id, case_id, question_order) VALUES (?, ?, ?)', [testId, caseId, order]);
      const newCount = existing.length + 1;
      await conn.query('UPDATE tests SET total_questions = ? WHERE id = ?', [newCount, testId]);
      await conn.commit();
      return { ok: true, id: r.insertId, question_order: order };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  /** Removes a question from a block and updates total_questions count. */
  async removeTestQuestion(testId, questionId) {
    const [[row]] = await pool.query(
      `SELECT tq.id FROM test_questions tq WHERE tq.id = ? AND tq.test_id = ?`,
      [questionId, testId]
    );
    if (!row) return { ok: false, code: 'not_found' };
    await pool.query('DELETE FROM test_questions WHERE id = ?', [questionId]);
    const [[cnt]] = await pool.query('SELECT COUNT(*) AS c FROM test_questions WHERE test_id = ?', [testId]);
    await pool.query('UPDATE tests SET total_questions = ? WHERE id = ?', [Math.max(cnt.c, 1), testId]);
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
