const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const testController = require('../controllers/testController');

const router = express.Router();

router.get('/', requireAuth, testController.listBlocks);
router.post('/:testId/start', requireAuth, testController.startTest);
router.post('/attempts/:attemptId/answers', requireAuth, testController.submitAnswer);
router.post('/attempts/:attemptId/complete', requireAuth, testController.completeAttempt);
router.get('/attempts/:attemptId/results', requireAuth, testController.getResults);

module.exports = router;
