const { displayAnswer } = require('../services/answerEvaluationService');
const systemModel = require('../models/systemModel');
const practiceCaseModel = require('../models/practiceCaseModel');

async function listCasesForSystem(req, res) {
  const { slug } = req.params;

  try {
    const system = await systemModel.findBySlug(slug);
    if (!system) {
      return res.status(404).json({ success: false, message: 'Radiology system not found.' });
    }

    const cases = await practiceCaseModel.findBySystemSlug(slug, req.user.id);

    return res.json({
      success: true,
      system: { id: system.id, name: system.name, slug: system.slug },
      cases,
    });
  } catch (err) {
    console.error('[practice] listCasesForSystem error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load cases for this system.' });
  }
}

async function getCase(req, res) {
  const { id } = req.params;

  try {
    const caseDetail = await practiceCaseModel.findByIdForStudent(id, req.user.id);
    if (!caseDetail) {
      return res.status(404).json({ success: false, message: 'This case is not available.' });
    }
    caseDetail.correct_answer = displayAnswer(caseDetail.correct_answer);
    return res.json({ success: true, case: caseDetail });
  } catch (err) {
    console.error('[practice] getCase error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load this case.' });
  }
}

module.exports = { listCasesForSystem, getCase };
