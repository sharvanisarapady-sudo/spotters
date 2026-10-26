const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const systemController = require('../controllers/systemController');

const router = express.Router();

router.get('/', requireAuth, systemController.listSystems);

module.exports = router;
