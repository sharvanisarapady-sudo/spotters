const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const progressController = require('../controllers/progressController');

const router = express.Router();

router.get('/', requireAuth, progressController.getProgress);

module.exports = router;
