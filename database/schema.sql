-- =========================================================
-- SPOTTERS.COM — Database Schema
-- Radiology Education & Assessment Platform
-- =========================================================
-- This schema is intentionally seeded with NO real or invented
-- radiology case content. Only structural data (users table,
-- system names, test block shells) is created. All medical
-- content is added later via the application's admin/API layer.
-- =========================================================

CREATE DATABASE IF NOT EXISTS spotters_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE spotters_db;

-- ---------------------------------------------------------
-- USERS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'doctor', 'admin') NOT NULL DEFAULT 'student',
  -- Doctor/Contributor portal is a future feature; the column exists now
  -- so the schema does not need to change when it is built.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- SYSTEMS (the 11 fixed radiology systems)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS systems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- PRACTICE CASES
-- Belongs to exactly one system. Populated later by the user.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS practice_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  system_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  modality VARCHAR(50) NULL,               -- e.g. CT, MRI, X-Ray, USG
  difficulty ENUM('easy', 'medium', 'hard') NULL,
  clinical_info TEXT NULL,
  question_text TEXT NULL,
  correct_answer VARCHAR(255) NULL,
  explanation TEXT NULL,
  key_findings TEXT NULL,
  learning_points TEXT NULL,
  differential_diagnosis TEXT NULL,
  status ENUM('draft', 'pending_review', 'approved', 'published') NOT NULL DEFAULT 'draft',
  created_by INT NULL,                      -- references users.id (doctor/admin who added it)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Supports multiple images per case (per spec section 11 & 28)
CREATE TABLE IF NOT EXISTS case_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- TESTS (Blocks) — independent of systems; a block mixes systems
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  block_number INT NOT NULL UNIQUE,        -- Block 1, Block 2, ...
  title VARCHAR(150) NOT NULL,
  total_questions INT NOT NULL DEFAULT 20,
  seconds_per_question INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Join table: a test question references a practice_case (which
-- carries the system), plus its position within the block.
CREATE TABLE IF NOT EXISTS test_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  test_id INT NOT NULL,
  case_id INT NOT NULL,
  question_order INT NOT NULL,             -- 1..20 within the block
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_test_position (test_id, question_order)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- TEST ATTEMPTS (one row per student's run through a Block)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_attempts (
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
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- TEST ANSWERS (server-side evaluated, one row per question answered)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT NOT NULL,
  user_id INT NOT NULL,
  test_id INT NOT NULL,
  question_id INT NOT NULL,                -- references test_questions.id
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
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- BOOKMARKS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookmarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  case_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_case (user_id, case_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- CASE VIDEOS (Navigation AI / Practice video explanations)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  video_url VARCHAR(500) NULL,
  title VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES practice_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- AI INTERACTIONS (Navigation AI usage log)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_interactions (
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
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------
CREATE INDEX idx_cases_system ON practice_cases(system_id);
CREATE INDEX idx_cases_status ON practice_cases(status);
CREATE INDEX idx_answers_user ON test_answers(user_id);
CREATE INDEX idx_attempts_user ON test_attempts(user_id);
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
