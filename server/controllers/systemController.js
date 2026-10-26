const systemModel = require('../models/systemModel');

async function listSystems(req, res) {
  try {
    const systems = await systemModel.findAllWithCaseCounts();
    return res.json({ success: true, systems });
  } catch (err) {
    console.error('[systems] list error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load radiology systems.' });
  }
}

module.exports = { listSystems };
