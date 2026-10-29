const { validationResult } = require('express-validator');
const navigationAiModel = require('../models/navigationAiModel');
const {
  analyzeAnswer,
  getModelStatus,
  trainModel,
  generateHint,
  answerFollowUp,
} = require('../services/aiService');

async function listCases(req, res) {
  try {
    const [cases] = await Promise.all([
      navigationAiModel.listCases(),
      trainModel(),
    ]);
    return res.json({ success: true, cases, modelStatus: getModelStatus() });
  } catch (err) {
    console.error('[navigation-ai] list error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load the AI Case Mentor library.' });
  }
}

async function getCase(req, res) {
  try {
    const caseData = await navigationAiModel.getCaseForStudent(req.params.id);
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'This case is not available in AI Case Mentor.' });
    }
    return res.json({ success: true, case: caseData, modelStatus: getModelStatus() });
  } catch (err) {
    console.error('[navigation-ai] getCase error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load this case.' });
  }
}

async function analyze(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const caseId = req.params.id;
  const studentAnswer = req.body.answer.trim();
  const inputMethod = req.body.inputMethod === 'voice' ? 'voice' : 'text';

  try {
    const [caseData, videos] = await Promise.all([
      navigationAiModel.getCaseForAnalysis(caseId),
      navigationAiModel.getVideos(caseId),
    ]);
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'This case is not available in AI Case Mentor.' });
    }

    const analysis = await analyzeAnswer({ caseData, studentAnswer });

    navigationAiModel
      .logInteraction({
        userId: req.user.id,
        caseId,
        inputMethod,
        studentAnswer,
        verdict: analysis.verdict,
        response: analysis,
      })
      .catch((err) => console.error('[navigation-ai] log error:', err.message));

    return res.json({ success: true, analysis, videos });
  } catch (err) {
    console.error('[navigation-ai] analyze error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not analyze your answer right now.' });
  }
}

async function hint(req, res) {
  try {
    const caseData = await navigationAiModel.getCaseForAnalysis(req.params.id);
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }
    const result = await generateHint(caseData);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[navigation-ai] hint error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not generate a hint right now.' });
  }
}

async function followUp(req, res) {
  const question = String(req.body.question || '').trim();
  if (!question) {
    return res.status(400).json({ success: false, message: 'Please enter a question for the AI Case Mentor.' });
  }
  try {
    const caseData = await navigationAiModel.getCaseForAnalysis(req.params.id);
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }
    const result = await answerFollowUp({
      caseData,
      question: question.slice(0, 400),
      studentAnswer: req.body.studentAnswer ? String(req.body.studentAnswer).slice(0, 400) : '',
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[navigation-ai] followUp error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not answer your question right now.' });
  }
}

module.exports = { listCases, getCase, analyze, hint, followUp };
