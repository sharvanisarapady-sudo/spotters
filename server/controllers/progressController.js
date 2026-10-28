const progressModel = require('../models/progressModel');

async function getProgress(req, res) {
  try {
    const [overview, systems, history, attemptedQuestions, activity] = await Promise.all([
      progressModel.getOverview(req.user.id),
      progressModel.getSystemPerformance(req.user.id),
      progressModel.getTestHistory(req.user.id),
      progressModel.getAttemptedQuestions(req.user.id),
      progressModel.getActivityStats(req.user.id),
    ]);
    const blocks = await progressModel.getBlockProgress(req.user.id, attemptedQuestions);
    return res.json({ success: true, overview, systems, history, attemptedQuestions, blocks, activity });
  } catch (err) {
    console.error('[progress] error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load your progress.' });
  }
}

async function getWrongAnswers(req, res) {
  try {
    const cases = await progressModel.getWrongAnswers(req.user.id);
    return res.json({ success: true, cases });
  } catch (err) {
    console.error('[progress] getWrongAnswers error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load missed questions.' });
  }
}

module.exports = { getProgress, getWrongAnswers };
