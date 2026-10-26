-- For databases created BEFORE Phase 7-11. Fresh installs get this from schema.sql.
-- Prevents the same question being answered twice in one attempt.
-- If this fails with a duplicate-entry error, remove the duplicate rows first.
ALTER TABLE test_answers ADD UNIQUE KEY uq_answer_per_question (attempt_id, question_id);
