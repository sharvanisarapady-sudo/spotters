const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/', requireAuth, dashboardController.getDashboard);

module.exports = router;
