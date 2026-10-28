const testModel = require('../models/testModel');
const { evaluateAnswer, displayAnswer } = require('../services/answerEvaluationService');

async function listBlocks(req, res) {
  try {
    const blocks = await testModel.listBlocks();
    const withStatus = blocks.map((b) => ({
  ...b,
  is_ready: b.is_active && b.question_count > 0,
}));
    return res.json({ success: true, blocks: withStatus });
  } catch (err) {
    console.error('[tests] listBlocks error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load test blocks.' });
  }
}

async function startTest(req, res) {
  const { testId } = req.params;

  try {
    const [block, questions] = await Promise.all([
      testModel.getBlockById(testId),
      testModel.getQuestionsForAttempt(testId),
      testModel.abandonInProgress(req.user.id, testId),
    ]);

    if (!block || !block.is_active) {
      return res.status(404).json({ success: false, message: 'This test block was not found.' });
    }

    const questionCount = questions.length;
    if (questionCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions are available for this test yet.',
      });
    }

    const attemptId = await testModel.createAttempt(req.user.id, testId, questionCount);

    return res.status(201).json({
      success: true,
      attempt: {
        id: attemptId,
        blockNumber: block.block_number,
        title: block.title,
        totalQuestions: questionCount,
        secondsPerQuestion: block.seconds_per_question,
      },
      questions,
    });
  } catch (err) {
    console.error('[tests] startTest error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not start this test.' });
  }
}

async function submitAnswer(req, res) {
  const { attemptId } = req.params;
  const { questionId, studentAnswer, timeTakenSeconds } = req.body;

  try {
    const [attempt, grading] = await Promise.all([
      testModel.getAttempt(attemptId),
      testModel.getGradingInfoById(questionId),
    ]);

    if (!attempt || attempt.user_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Test attempt not found.' });
    }
    if (attempt.status !== 'in_progress') {
      return res.json({ success: true, message: 'Answer recorded.' });
    }

    if (!grading || Number(grading.test_id) !== Number(attempt.test_id)) {
      return res.status(404).json({ success: false, message: 'Question not found for this test.' });
    }

    const isCorrect = evaluateAnswer(studentAnswer, grading.correct_answer);

    await testModel.saveAnswer({
      attemptId,
      userId: req.user.id,
      testId: attempt.test_id,
      questionId,
      caseId: grading.case_id,
      studentAnswer: studentAnswer || '',
      isCorrect,
      timeTaken: timeTakenSeconds,
    });

    // Correct/incorrect is withheld until the results page, per spec.
    return res.json({ success: true, message: 'Answer recorded.' });
  } catch (err) {
    console.error('[tests] submitAnswer error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not save your answer.' });
  }
}

async function completeAttempt(req, res) {
  const { attemptId } = req.params;

  try {
    const attempt = await testModel.getAttempt(attemptId);
    if (!attempt || attempt.user_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Test attempt not found.' });
    }
    if (attempt.status === 'completed') {
      return res.json({ success: true, message: 'Test already completed.' });
    }

    const result = await testModel.completeAttempt(attemptId);
    return res.json({ success: true, result });
  } catch (err) {
    console.error('[tests] completeAttempt error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not complete this test.' });
  }
}

async function getResults(req, res) {
  const { attemptId } = req.params;

  try {
    let attempt = await testModel.getAttempt(attemptId);
    if (!attempt || attempt.user_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Test attempt not found.' });
    }
    if (attempt.status !== 'completed') {
      const completedSummary = await testModel.completeAttempt(attemptId);
      attempt = {
        ...attempt,
        status: 'completed',
        score: completedSummary.score,
        total_questions: completedSummary.total,
        accuracy: completedSummary.accuracy,
        completed_at: new Date().toISOString(),
      };
    }

    const [block, rawReview] = await Promise.all([
      testModel.getBlockById(attempt.test_id),
      testModel.getAttemptReview(attemptId),
    ]);

    const review = rawReview.map((q) => ({
      ...q,
      correct_answer: displayAnswer(q.correct_answer),
    }));

    return res.json({
      success: true,
      attempt: {
        id: attempt.id,
        testId: attempt.test_id,
        blockNumber: block?.block_number,
        title: block?.title,
        blockType: block?.block_type || 'regular',
        score: attempt.score,
        total: attempt.total_questions,
        accuracy: attempt.accuracy,
        completedAt: attempt.completed_at,
      },
      review,
    });
  } catch (err) {
    console.error('[tests] getResults error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load your results.' });
  }
}

module.exports = { listBlocks, startTest, submitAnswer, completeAttempt, getResults };
