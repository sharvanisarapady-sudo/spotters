const progressModel = require('../models/progressModel');

async function getProgress(req, res) {
  try {
    const [overview, systems, history] = await Promise.all([
      progressModel.getOverview(req.user.id),
      progressModel.getSystemPerformance(req.user.id),
      progressModel.getTestHistory(req.user.id),
    ]);
    return res.json({ success: true, overview, systems, history });
  } catch (err) {
    console.error('[progress] error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load your progress.' });
  }
}

module.exports = { getProgress };
