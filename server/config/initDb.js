const { pool } = require('./db');
const caseAdminModel = require('../models/caseAdminModel');
const { evaluateAnswer } = require('../services/answerEvaluationService');

const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'doctor', 'admin') NOT NULL DEFAULT 'student',
    institution VARCHAR(200) NULL,
    specialization VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    location VARCHAR(150) NULL,
    daily_goal INT NOT NULL DEFAULT 10,
    bio TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS systems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS practice_cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    system_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    modality VARCHAR(50) NULL,
    difficulty ENUM('easy', 'medium', 'hard') NULL,
    clinical_info TEXT NULL,
    question_text TEXT NULL,
    correct_answer VARCHAR(255) NULL,
    explanation TEXT NULL,
    key_findings TEXT NULL,
    learning_points TEXT NULL,
    differential_diagnosis TEXT NULL,
    status ENUM('draft', 'pending_review', 'approved', 'published') NOT NULL DEFAULT 'draft',
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS case_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    block_number INT NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    block_type VARCHAR(20) NOT NULL DEFAULT 'regular',
    system_id INT NULL,
    total_questions INT NOT NULL DEFAULT 20,
    seconds_per_question INT NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS test_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id INT NOT NULL,
    case_id INT NOT NULL,
    question_order INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_test_position (test_id, question_order)
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS test_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    test_id INT NOT NULL,
    status ENUM('in_progress', 'completed', 'abandoned') NOT NULL DEFAULT 'in_progress',
    score INT NULL,
    total_questions INT NULL,
    accuracy DECIMAL(5,2) NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS test_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    user_id INT NOT NULL,
    test_id INT NOT NULL,
    question_id INT NOT NULL,
    case_id INT NOT NULL,
    student_answer TEXT NULL,
    is_correct BOOLEAN NULL,
    time_taken_seconds INT NULL,
    answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES test_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE,
    UNIQUE KEY uq_answer_per_question (attempt_id, question_id)
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    case_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_user_case (user_id, case_id)
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS case_videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    video_url VARCHAR(500) NULL,
    title VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS ai_interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    case_id INT NULL,
    input_method ENUM('text', 'voice') NOT NULL DEFAULT 'text',
    student_answer TEXT NULL,
    ai_verdict ENUM('correct', 'incorrect', 'unavailable') NULL,
    ai_response TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS study_planner (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    system_name VARCHAR(100) NULL,
    task_type VARCHAR(50) NOT NULL DEFAULT 'practice',
    scheduled_date DATE NOT NULL,
    scheduled_time VARCHAR(20) NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS stored_files (
    filename VARCHAR(120) PRIMARY KEY,
    mime_type VARCHAR(60) NOT NULL,
    file_data LONGBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
];

const INITIAL_CASES = [
  [
    1,
    7,
    'Ebstein Anomaly – Box-Shaped Heart',
    'X-Ray',
    'medium',
    'Chest radiograph demonstrating marked cardiomegaly in a child.',
    'Identify the diagnosis based on the radiographic appearance.',
    'Ebstein Anomaly',
    'The characteristic box-shaped cardiac silhouette is associated with marked enlargement of the right atrium and right ventricle in Ebstein anomaly.',
    'Marked cardiomegaly with a characteristic box-shaped cardiac silhouette.',
    'Recognize the box-shaped cardiac silhouette as a classic radiographic clue to Ebstein anomaly.',
    'Other causes of marked cardiomegaly, including congenital heart disease and pericardial effusion.',
    'published',
  ],
  [
    2,
    2,
    'Mock MRI: right frontal lesion',
    'MRI',
    'medium',
    'Headaches for 3 weeks. (Synthetic mock image for app testing, not a real patient.)',
    'What is the most likely diagnosis? Scroll through all 20 slices.',
    'Brain tumour | Brain tumor | Glioma | Intracranial mass',
    'Mock case for testing the scrolling viewer. Rounded bright lesion in the right frontal lobe with a surrounding halo of oedema, seen on about slices 7 to 14 of 20.',
    'Rounded bright lesion in the right frontal lobe with a surrounding halo of oedema, seen on about slices 7 to 14 of 20.',
    'Look for a focal bright rounded area with a rim of swelling; it appears and disappears as you scroll.',
    'Hydrocephalus; Ischaemic stroke',
    'published',
  ],
  [
    3,
    2,
    'Mock MRI: left hemisphere wedge',
    'MRI',
    'medium',
    'Sudden weakness on the right side of the body. (Synthetic mock image for app testing, not a real patient.)',
    'What is the most likely diagnosis? Scroll through all 20 slices.',
    'Ischaemic stroke | Ischemic stroke | Acute infarct | Cerebral infarction',
    'Mock case for testing the scrolling viewer. Wedge-shaped bright area in the left hemisphere, seen on about slices 8 to 14 of 20, with no mass effect on the ventricles.',
    'Wedge-shaped bright area in the left hemisphere, seen on about slices 8 to 14 of 20, with no mass effect on the ventricles.',
    'A wedge-shaped bright region following a vascular territory points to an infarct rather than a mass.',
    'Brain tumour; Hydrocephalus',
    'published',
  ],
  [
    4,
    2,
    'Mock MRI: enlarged ventricles',
    'MRI',
    'easy',
    'Worsening headache and unsteady walking. (Synthetic mock image for app testing, not a real patient.)',
    'What is the most likely diagnosis? Scroll through all 20 slices.',
    'Hydrocephalus',
    'Mock case for testing the scrolling viewer. Both lateral ventricles are markedly enlarged and bright, seen on about slices 6 to 15 of 20, with no separate focal lesion.',
    'Both lateral ventricles are markedly enlarged and bright, seen on about slices 6 to 15 of 20, with no separate focal lesion.',
    'Compare ventricle size with the other cases: much larger and symmetrical on both sides.',
    'Brain tumour; Ischaemic stroke',
    'published',
  ],
  [
    5,
    2,
    'Developmental venous Anomaly',
    'MRI',
    'medium',
    'Incidental finding on brain MRI.',
    'Identify the vascular abnormality demonstrated in this MRI image.',
    'Developmental venous Anomaly',
    "A Developmental Venous Anomaly (DVA) is a congenital variation in the brain's venous drainage. On MRI, particularly susceptibility-sensitive or contrast-enhanced sequences, multiple small medullary veins converge into a larger draining vein, creating a characteristic 'caput medusae' or 'Medusa head' appearance. DVAs are usually benign and are often discovered incidentally.",
    "Multiple small veins converging into a single larger draining vein.\nCharacteristic 'caput medusae' appearance.\nAbnormal venous drainage pattern.\nTypically an incidental finding.",
    'Recognize the characteristic venous drainage pattern of a DVA.\nUnderstand the difference between a DVA and other cerebral vascular malformations.\nDVAs are usually benign; avoid unnecessary intervention in uncomplicated cases.',
    'Cerebral cavernous malformation.\nArteriovenous malformation (AVM).\nCerebral venous thrombosis.',
    'published',
  ],
  [
    6,
    4,
    'Xanthogranulomatous pyelonephritis',
    'CT',
    'easy',
    '55-year-old diabetic woman with recurrent UTIs',
    'a. What is the characteristic sign on non-contrast CT?\nb. What is the definitive treatment in case of non-functioning kidney?',
    'a. Bear-paw sign b. Nephrectomy | Bear-paw sign | Bear paw sign | Xanthogranulomatous pyelonephritis',
    'CT shows an enlarged left kidney with a large calculus (possibly staghorn) at the renal pelvis with dilated calyces with hypodense content within, which represents xanthogranulomatous content.\nIn the setting of a diabetic patient with recurrent UTIs, xanthogranulomatous pyelonephritis becomes the primary differential.',
    'Obstructive calculus; Dilated renal calyces with hypodense content (Bear-paw sign).',
    'In acute hydronephrosis, the content within the calyces is fluid attenuating. Xanthogranulomatous content is usually denser.',
    'Obstructive hydronephrosis',
    'published',
  ],
  [
    7,
    7,
    'Sarcoidosis',
    'X-Ray',
    'medium',
    '40-year-old woman with dry cough',
    'a. What is the name of the sign?\nb. Elucidate the characteristic histopathological finding.',
    'a. Garland triad b. Non-caseating granulomas | Garland triad | Garland sign | Sarcoidosis',
    'Plain radiograph of the chest shows enlarged and lobulated bilateral hila. The right paratracheal stripe is also widened. These three features denote the classical Garland sign, where there are enlarged lymph nodes in the right paratracheal region and bilateral hilar regions.',
    'Hilar and right paratracheal lymphadenopathy (Garland triad / 1-2-3 sign).',
    'When both the hila are enlarged, check if they are smooth or lobulated. Smooth hilar enlargement favours pulmonary arterial dilation; lobulated hilar contour usually denotes lymphadenopathy.',
    'Other causes of mediastinal lymphadenopathy such as lymphoma, granulomatous or metastatic disease.',
    'published',
  ],
];

async function initDb() {
  try {
    // Fast-path check: if initial seeding has already completed (even if admin deleted all sample cases),
    // skip 18 sequential DDL/seed round-trips and never resurrect deleted sample cases.
    let alreadyInitialized = false;
    try {
      const [seedFlag] = await pool.query(
        `SELECT setting_value FROM app_settings WHERE setting_key = 'initial_seed_done' LIMIT 1`
      );
      if (seedFlag[0] && seedFlag[0].setting_value === '1') {
        alreadyInitialized = true;
      } else {
        const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM practice_cases');
        if (Number(cnt) > 0) {
          alreadyInitialized = true;
          await pool
            .query(
              `INSERT INTO app_settings (setting_key, setting_value) VALUES ('initial_seed_done', '1')
               ON DUPLICATE KEY UPDATE setting_value = '1'`
            )
            .catch(() => {});
        }
      }
    } catch {
      alreadyInitialized = false;
    }

    if (!alreadyInitialized) {
      for (const sql of CREATE_TABLES) {
        await pool.query(sql);
      }

      // Add block_type and system_id to tests if upgrading from an older schema
      try {
        await pool.query(`ALTER TABLE tests ADD COLUMN block_type VARCHAR(20) NOT NULL DEFAULT 'regular'`);
      } catch {
        // column already exists
      }
      try {
        await pool.query(`ALTER TABLE tests ADD COLUMN system_id INT NULL`);
      } catch {
        // column already exists
      }

      // Seed the 11 radiology systems if not present
      await pool.query(
        `INSERT INTO systems (name, slug, display_order) VALUES
          ('Head and Neck Radiology', 'head-and-neck-radiology', 1),
          ('Neuroradiology', 'neuroradiology', 2),
          ('Hepatobiliary & Pancreatic Imaging', 'hepatobiliary-pancreatic-imaging', 3),
          ('Genitourinary Radiology', 'genitourinary-radiology', 4),
          ('Gastrointestinal Radiology', 'gastrointestinal-radiology', 5),
          ('Vascular Radiology', 'vascular-radiology', 6),
          ('Cardiothoracic Radiology', 'cardiothoracic-radiology', 7),
          ('Obstetric & Fetal Imaging', 'obstetric-fetal-imaging', 8),
          ('Gynecologic Imaging', 'gynecologic-imaging', 9),
          ('Oncologic Imaging', 'oncologic-imaging', 10),
          ('Musculoskeletal Radiology', 'musculoskeletal-radiology', 11)
        ON DUPLICATE KEY UPDATE display_order = VALUES(display_order)`
      );

      // Ensure at least Blocks 1–5 exist
      await pool.query(
        `INSERT INTO tests (block_number, title, total_questions, seconds_per_question, is_active) VALUES
          (1, 'Block 1', 10, 60, TRUE),
          (2, 'Block 2', 10, 60, TRUE),
          (3, 'Block 3', 10, 60, TRUE),
          (4, 'Block 4', 10, 60, TRUE),
          (5, 'Block 5', 10, 60, TRUE)
        ON DUPLICATE KEY UPDATE is_active = VALUES(is_active)`
      );

      // Seed initial cases & images only once on a brand-new database
      const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM practice_cases');
      if (Number(cnt) === 0) {
        for (const c of INITIAL_CASES) {
          await pool.query(
            `INSERT INTO practice_cases
              (id, system_id, title, modality, difficulty, clinical_info, question_text, correct_answer, explanation, key_findings, learning_points, differential_diagnosis, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            c
          );
        }

        const images = [
          [1, '/uploads/cases/2081e1ff-f483-4c88-b034-be761562c66f.jpg', 1],
          ...Array.from({ length: 20 }, (_, i) => [2, `/uploads/cases/mock-mri-tumour-${String(i + 1).padStart(2, '0')}.png`, i + 1]),
          ...Array.from({ length: 20 }, (_, i) => [3, `/uploads/cases/mock-mri-stroke-${String(i + 1).padStart(2, '0')}.png`, i + 1]),
          ...Array.from({ length: 20 }, (_, i) => [4, `/uploads/cases/mock-mri-hydro-${String(i + 1).padStart(2, '0')}.png`, i + 1]),
          [5, '/uploads/cases/af3f1fff-9329-4ba4-90dd-6bfc6c6de062.png', 1],
          [6, '/uploads/cases/fa5d01e9-da7a-4990-9097-80ee03cb0556.jpg', 1],
          [7, '/uploads/cases/7758fa7a-646a-4ef6-81ee-911fd4af6568.jpg', 1],
        ];
        for (const [caseId, url, order] of images) {
          await pool.query(
            'INSERT INTO case_images (case_id, image_url, display_order) VALUES (?, ?, ?)',
            [caseId, url, order]
          );
        }
      }

      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ('initial_seed_done', '1')
         ON DUPLICATE KEY UPDATE setting_value = '1'`
      );
    }

    await pool.query(
      `CREATE TABLE IF NOT EXISTS stored_files (
         filename VARCHAR(120) PRIMARY KEY,
         mime_type VARCHAR(60) NOT NULL,
         file_data LONGBLOB NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB`
    );
    await caseAdminModel.ensureSynced();

    console.log('[db] Schema, seed cases & random test blocks verified');
  } catch (err) {
    console.warn('[db] Schema initialization warning:', err.message);
  }
}

module.exports = { initDb };
