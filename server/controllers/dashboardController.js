const progressModel = require('../models/progressModel');

// The dashboard and the Progress page share one set of aggregates so the
// numbers can never disagree.
async function getDashboard(req, res) {
  try {
    const [stats, recentTests] = await Promise.all([
      progressModel.getOverview(req.user.id),
      progressModel.getTestHistory(req.user.id, 5),
    ]);

    return res.json({ success: true, stats, recentTests });
  } catch (err) {
    console.error('[dashboard] error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load your dashboard.' });
  }
}

module.exports = { getDashboard };
