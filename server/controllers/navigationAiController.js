const { validationResult } = require('express-validator');
const navigationAiModel = require('../models/navigationAiModel');
const { analyzeAnswer } = require('../services/aiService');

async function listCases(req, res) {
  try {
    const cases = await navigationAiModel.listCases();
    return res.json({ success: true, cases });
  } catch (err) {
    console.error('[navigation-ai] list error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load the Navigation AI case library.' });
  }
}

async function getCase(req, res) {
  try {
    const caseData = await navigationAiModel.getCaseForStudent(req.params.id);
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'This case is not available in Navigation AI.' });
    }
    return res.json({ success: true, case: caseData });
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
    const caseData = await navigationAiModel.getCaseForAnalysis(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'This case is not available in Navigation AI.' });
    }

    const analysis = await analyzeAnswer({ caseData, studentAnswer });

    // Videos are only revealed after an answer has been analyzed — a
    // video explanation would otherwise give the diagnosis away.
    const videos = await navigationAiModel.getVideos(caseId);

    // Logging must never block the student from seeing their feedback.
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

module.exports = { listCases, getCase, analyze };
