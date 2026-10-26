-- =========================================================
-- SPOTTERS.COM — Structural Seed Data
-- =========================================================
-- Per project rules, this file seeds ONLY structural data:
--   - The 11 fixed radiology systems
--   - Empty test block shells (no questions attached)
-- It does NOT seed any case content, images, diagnoses,
-- explanations, or patient data.
--
-- The demo student account is created separately by
-- `server/scripts/seedDemoUser.js` because its password must
-- be bcrypt-hashed at insert time rather than hardcoded here.
-- =========================================================

USE spotters_db;

-- ---- 11 Radiology Systems (exact names, fixed order) ----
INSERT INTO systems (name, slug, display_order) VALUES
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
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order);

-- ---- Empty Test Block shells (no questions yet) ----
INSERT INTO tests (block_number, title, total_questions, seconds_per_question, is_active) VALUES
  (1, 'Block 1', 20, 60, TRUE),
  (2, 'Block 2', 20, 60, TRUE),
  (3, 'Block 3', 20, 60, TRUE),
  (4, 'Block 4', 20, 60, TRUE)
ON DUPLICATE KEY UPDATE title = VALUES(title);
