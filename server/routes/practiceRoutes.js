const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const practiceController = require('../controllers/practiceController');

const router = express.Router();

router.get('/systems/:slug/cases', requireAuth, practiceController.listCasesForSystem);
router.get('/cases/:id', requireAuth, practiceController.getCase);

module.exports = router;
