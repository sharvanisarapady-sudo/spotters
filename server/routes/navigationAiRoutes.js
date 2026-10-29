const express = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/authMiddleware');
const navigationAiController = require('../controllers/navigationAiController');

const rateLimit = require('../middleware/rateLimit');

const router = express.Router();
// 60 per minute per IP: enough for a real classroom without being spammable.
// Was 20/30, raised after load testing showed legitimate concurrent students hitting the limit.
const analyzeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: 'You are submitting too quickly. Please wait a moment.' });

router.get('/cases', requireAuth, navigationAiController.listCases);
router.get('/cases/:id', requireAuth, navigationAiController.getCase);
router.post('/cases/:id/hint', requireAuth, analyzeLimiter, navigationAiController.hint);
router.post('/cases/:id/followup', requireAuth, analyzeLimiter, navigationAiController.followUp);
router.post(
  '/cases/:id/analyze',
  requireAuth,
  analyzeLimiter,
  [
    body('answer')
      .isString()
      .withMessage('Please enter or speak your diagnosis.')
      .bail()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Your answer must be between 1 and 500 characters.'),
    body('inputMethod').optional().isIn(['text', 'voice']),
  ],
  navigationAiController.analyze
);

module.exports = router;
