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
   * Automatically ensures all published cases with answer keys are:
   * 1. Uniquely and randomly assigned across Regular Test Blocks (Block 1, Block 2, ... growing infinitely).
   * 2. Automatically assigned to their corresponding System-Based Block (11 System Blocks, 1 per Radiology System).
   */
  async autoSyncBlocks({ reshuffleAll = false, questionsPerBlock = null } = {}) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await ensureSettingsTable(conn);

      // Ensure block_type and system_id columns exist on tests
      try {
        await conn.query(`ALTER TABLE tests ADD COLUMN block_type VARCHAR(20) NOT NULL DEFAULT 'regular'`);
      } catch {
        // already exists
      }
      try {
        await conn.query(`ALTER TABLE tests ADD COLUMN system_id INT NULL`);
      } catch {
        // already exists
      }

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

      // 1. All valid published cases (with system_id)
      const [publishedRows] = await conn.query(
        `SELECT id, system_id FROM practice_cases
         WHERE status = 'published' AND correct_answer IS NOT NULL AND TRIM(correct_answer) <> ''
         ORDER BY id ASC`
      );
      const publishedIds = publishedRows.map((r) => r.id);
      const publishedSet = new Set(publishedIds);

      // =========================================================
      // PART A: REGULAR BLOCKS (block_type = 'regular', Block 1, 2, 3...)
      // =========================================================
      let [regularBlocks] = await conn.query(
        `SELECT id, block_number, seconds_per_question
         FROM tests
         WHERE block_type = 'regular'
         ORDER BY block_number ASC FOR UPDATE`
      );
      if (regularBlocks.length === 0) {
        const [ins] = await conn.query(
          `INSERT INTO tests (block_number, title, block_type, system_id, total_questions, seconds_per_question, is_active)
           VALUES (1, 'Block 1', 'regular', NULL, ?, 60, 1)`,
          [capacity]
        );
        regularBlocks = [{ id: ins.insertId, block_number: 1, seconds_per_question: 60 }];
      }

      const regularBlockIds = new Set(regularBlocks.map((b) => b.id));

      const [existingRegularTq] = await conn.query(
        `SELECT tq.id, tq.test_id, tq.case_id, tq.question_order
         FROM test_questions tq
         JOIN tests t ON t.id = tq.test_id
         WHERE t.block_type = 'regular'
         ORDER BY tq.test_id ASC, tq.question_order ASC FOR UPDATE`
      );
      const seenRegularCases = new Set();
      const validRegularTqByCase = new Map();
      const invalidRegularTqIds = [];

      for (const row of existingRegularTq) {
        if (!publishedSet.has(row.case_id) || seenRegularCases.has(row.case_id) || !regularBlockIds.has(row.test_id)) {
          invalidRegularTqIds.push(row.id);
        } else {
          seenRegularCases.add(row.case_id);
          validRegularTqByCase.set(row.case_id, row);
        }
      }

      if (invalidRegularTqIds.length > 0) {
        await conn.query(
          `DELETE FROM test_questions WHERE id IN (${invalidRegularTqIds.map(() => '?').join(',')})`,
          invalidRegularTqIds
        );
      }

      if (reshuffleAll) {
        const shuffledCaseIds = shuffleArray(publishedIds);
        const neededBlocks = Math.max(1, Math.ceil(shuffledCaseIds.length / capacity));

        while (regularBlocks.length < neededBlocks) {
          const nextBlockNum = regularBlocks[regularBlocks.length - 1].block_number + 1;
          const [ins] = await conn.query(
            `INSERT INTO tests (block_number, title, block_type, system_id, total_questions, seconds_per_question, is_active)
             VALUES (?, ?, 'regular', NULL, ?, 60, 1)`,
            [nextBlockNum, `Block ${nextBlockNum}`, capacity]
          );
          regularBlocks.push({ id: ins.insertId, block_number: nextBlockNum, seconds_per_question: 60 });
        }

        const regIdsList = regularBlocks.map((b) => b.id);
        await conn.query(
          `UPDATE test_questions SET question_order = id + 100000 WHERE test_id IN (${regIdsList.map(() => '?').join(',')})`,
          regIdsList
        );

        for (let i = 0; i < shuffledCaseIds.length; i += 1) {
          const caseId = shuffledCaseIds[i];
          const blockIdx = Math.floor(i / capacity);
          const orderInBlock = (i % capacity) + 1;
          const targetTestId = regularBlocks[blockIdx].id;

          const existingRow = validRegularTqByCase.get(caseId);
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
        const unassignedCaseIds = shuffleArray(publishedIds.filter((id) => !validRegularTqByCase.has(id)));

        if (unassignedCaseIds.length > 0) {
          const blockCasesMap = new Map(regularBlocks.map((b) => [b.id, []]));
          for (const row of validRegularTqByCase.values()) {
            if (!blockCasesMap.has(row.test_id)) blockCasesMap.set(row.test_id, []);
            blockCasesMap.get(row.test_id).push(row);
          }

          const touchedBlockIds = new Set();

          for (const newCaseId of unassignedCaseIds) {
            let targetBlock = regularBlocks.find((b) => (blockCasesMap.get(b.id)?.length || 0) < capacity);

            if (!targetBlock) {
              const nextBlockNum = regularBlocks[regularBlocks.length - 1].block_number + 1;
              const [ins] = await conn.query(
                `INSERT INTO tests (block_number, title, block_type, system_id, total_questions, seconds_per_question, is_active)
                 VALUES (?, ?, 'regular', NULL, ?, 60, 1)`,
                [nextBlockNum, `Block ${nextBlockNum}`, capacity]
              );
              targetBlock = { id: ins.insertId, block_number: nextBlockNum, seconds_per_question: 60 };
              regularBlocks.push(targetBlock);
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

      // =========================================================
      // PART B: SYSTEM-BASED BLOCKS (11 Blocks — 1 per Radiology System)
      // =========================================================
      const [allSystems] = await conn.query(
        'SELECT id, name, slug, display_order FROM systems ORDER BY display_order ASC, id ASC'
      );
      const [existingSysBlocks] = await conn.query(
        `SELECT id, block_number, system_id, title FROM tests WHERE block_type = 'system' FOR UPDATE`
      );
      const sysBlockBySystemId = new Map(existingSysBlocks.map((b) => [b.system_id, b]));

      for (const sys of allSystems) {
        let sysBlock = sysBlockBySystemId.get(sys.id);
        const sysBlockNumber = 1000 + (sys.display_order || sys.id);
        if (!sysBlock) {
          const [ins] = await conn.query(
            `INSERT INTO tests (block_number, title, block_type, system_id, total_questions, seconds_per_question, is_active)
             VALUES (?, ?, 'system', ?, 10, 60, 1)
             ON DUPLICATE KEY UPDATE block_type = 'system', system_id = VALUES(system_id), title = VALUES(title)`,
            [sysBlockNumber, sys.name, sys.id]
          );
          let sysTestId = ins.insertId;
          if (!sysTestId) {
            const [[found]] = await conn.query('SELECT id FROM tests WHERE block_number = ? LIMIT 1', [sysBlockNumber]);
            sysTestId = found.id;
          }
          sysBlock = { id: sysTestId, block_number: sysBlockNumber, system_id: sys.id, title: sys.name };
          sysBlockBySystemId.set(sys.id, sysBlock);
        }

        const sysCaseIds = publishedRows.filter((r) => r.system_id === sys.id).map((r) => r.id);
        const sysCaseSet = new Set(sysCaseIds);

        const [sysTq] = await conn.query(
          'SELECT id, case_id, question_order FROM test_questions WHERE test_id = ? ORDER BY question_order ASC FOR UPDATE',
          [sysBlock.id]
        );
        const seenInSys = new Set();
        const validSysTq = [];
        const invalidSysTqIds = [];

        for (const row of sysTq) {
          if (!sysCaseSet.has(row.case_id) || seenInSys.has(row.case_id)) {
            invalidSysTqIds.push(row.id);
          } else {
            seenInSys.add(row.case_id);
            validSysTq.push(row);
          }
        }

        if (invalidSysTqIds.length > 0) {
          await conn.query(
            `DELETE FROM test_questions WHERE id IN (${invalidSysTqIds.map(() => '?').join(',')})`,
            invalidSysTqIds
          );
        }

        const missingSysCases = shuffleArray(sysCaseIds.filter((cid) => !seenInSys.has(cid)));
        if (missingSysCases.length > 0 || reshuffleAll) {
          for (let i = 0; i < missingSysCases.length; i += 1) {
            const cid = missingSysCases[i];
            const tempOrd = 60000 + i;
            const [ins] = await conn.query(
              'INSERT INTO test_questions (test_id, case_id, question_order) VALUES (?, ?, ?)',
              [sysBlock.id, cid, tempOrd]
            );
            validSysTq.push({ id: ins.insertId, case_id: cid, question_order: tempOrd });
          }

          if (validSysTq.length > 0) {
            await conn.query('UPDATE test_questions SET question_order = id + 100000 WHERE test_id = ?', [sysBlock.id]);
            const shuffledSysTq = shuffleArray(validSysTq);
            for (let idx = 0; idx < shuffledSysTq.length; idx += 1) {
              await conn.query(
                'UPDATE test_questions SET question_order = ? WHERE id = ?',
                [idx + 1, shuffledSysTq[idx].id]
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
    const [blocks] = await pool.query(
      `SELECT t.id, t.block_number, t.title, t.block_type, t.system_id, t.total_questions, t.seconds_per_question, t.is_active,
              s.name AS system_name, s.display_order AS system_order
       FROM tests t
       LEFT JOIN systems s ON s.id = t.system_id
       ORDER BY t.block_type ASC, COALESCE(s.display_order, t.block_number) ASC`
    );
    const [qs] = await pool.query(
      `SELECT tq.id, tq.test_id, tq.case_id, tq.question_order, pc.title, pc.status, pc.modality,
              s.name AS system_name,
              (SELECT COUNT(*) FROM test_answers ta WHERE ta.question_id = tq.id) AS answer_count
       FROM test_questions tq
       JOIN practice_cases pc ON pc.id = tq.case_id
       JOIN systems s ON s.id = pc.system_id
       ORDER BY tq.test_id, tq.question_order`
    );
    const allWithQs = blocks.map((b) => ({ ...b, questions: qs.filter((q) => q.test_id === b.id) }));
    return {
      questionsPerBlock,
      blocks: allWithQs.filter((b) => b.block_type !== 'system'),
      systemBlocks: allWithQs.filter((b) => b.block_type === 'system'),
    };
  },

  /** Creates a new regular test block (auto-assigns the next regular block_number if not provided). */
  async createBlock({ blockNumber, title, secondsPerQuestion = 60 } = {}) {
    let nextNum = Number(blockNumber);
    if (!Number.isInteger(nextNum) || nextNum < 1) {
      const [[row]] = await pool.query(
        `SELECT COALESCE(MAX(block_number), 0) + 1 AS next FROM tests WHERE block_type = 'regular'`
      );
      nextNum = row.next;
    }
    const blockTitle = (title && title.trim()) || `Block ${nextNum}`;
    const secs = Number(secondsPerQuestion) > 0 ? Number(secondsPerQuestion) : 60;
    const [r] = await pool.query(
      `INSERT INTO tests (block_number, title, block_type, system_id, total_questions, seconds_per_question, is_active)
       VALUES (?, ?, 'regular', NULL, 10, ?, 1)`,
      [nextNum, blockTitle, secs]
    );
    return { id: r.insertId, block_number: nextNum, title: blockTitle, block_type: 'regular', seconds_per_question: secs };
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
