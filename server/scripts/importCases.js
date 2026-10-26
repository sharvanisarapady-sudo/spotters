/**
 * Bulk-imports cases YOU authored from a JSON file (see database/cases.template.json).
 * Nothing is generated or invented. Imported cases land as 'draft' — review and
 * publish them via the admin API.  Image paths are stored as given
 * (e.g. "/uploads/cases/xyz.jpg" or a cloud URL).
 * Usage: node scripts/importCases.js path/to/cases.json
 */
require('dotenv').config();
const fs = require('fs');
const { pool } = require('../config/db');

(async () => {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node scripts/importCases.js cases.json'); process.exit(1); }
  const cases = JSON.parse(fs.readFileSync(file, 'utf8')).cases || [];
  let ok = 0, skipped = 0;
  for (const c of cases) {
    if (!c.title || !c.system_slug) { skipped += 1; continue; } // template/blank rows are skipped
    const [sysRows] = await pool.query('SELECT id FROM systems WHERE slug = ?', [c.system_slug]);
    const sys = sysRows[0];
    if (!sys) { console.warn(`[import] unknown system_slug "${c.system_slug}" — skipped "${c.title}"`); skipped += 1; continue; }
    const [r] = await pool.query(
      `INSERT INTO practice_cases (system_id, title, modality, difficulty, clinical_info, question_text, correct_answer,
         explanation, key_findings, learning_points, differential_diagnosis, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'draft')`,
      [sys.id, c.title, c.modality || null, c.difficulty || null, c.clinical_info || null, c.question_text || null,
       c.correct_answer || null, c.explanation || null, c.key_findings || null, c.learning_points || null, c.differential_diagnosis || null]
    );
    let order = 1;
    for (const url of c.images || []) await pool.query('INSERT INTO case_images (case_id, image_url, display_order) VALUES (?,?,?)', [r.insertId, url, order++]);
    for (const v of c.videos || []) await pool.query('INSERT INTO case_videos (case_id, video_url, title) VALUES (?,?,?)', [r.insertId, v.video_url, v.title || null]);
    ok += 1;
  }
  console.log(`[import] imported ${ok} draft case(s), skipped ${skipped}.`);
  process.exit(0);
})().catch((e) => { console.error('[import] failed:', e.message); process.exit(1); });
