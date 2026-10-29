const express = require('express');
const { body, param } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const c = require('../controllers/adminController');
const { handleImageUpload, handleVideoUpload } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const text = (f, max) => body(f).optional({ nullable: true }).isString().isLength({ max }).withMessage(`${f} is too long.`);
const caseBody = [
  text('title', 255), text('modality', 80), text('clinical_info', 20000), text('question_text', 20000),
  text('correct_answer', 5000), text('explanation', 20000), text('key_findings', 20000),
  text('learning_points', 20000), text('differential_diagnosis', 20000),
  body('system_id').optional().isInt({ min: 1 }).withMessage('Invalid system.'),
  body('difficulty').optional({ nullable: true }).isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty.'),
];
const id = param('id').isInt({ min: 1 }).withMessage('Invalid id.');
// Local uploads ("/uploads/...") or http(s) URLs only — blocks javascript: etc.
const url = (f) => body(f).isString().trim().isLength({ max: 500 }).matches(/^(\/uploads\/|https?:\/\/)/).withMessage('Enter an http(s) URL or /uploads/ path.');

router.get('/cases', c.listCases);
router.get('/cases/:id', id, c.getCase);
router.post('/cases', [body('title').isString().trim().notEmpty().withMessage('Title is required.'), body('system_id').isInt({ min: 1 }).withMessage('System is required.'), ...caseBody], c.createCase);
router.put('/cases/:id', id, caseBody, c.updateCase);
router.patch('/cases/:id/status', id, body('status').isIn(['draft', 'pending_review', 'approved', 'published']).withMessage('Invalid status.'), c.setStatus);
router.delete('/cases/:id', requireRole('admin'), id, c.deleteCase);
router.post('/cases/:id/images/upload', c.requireExistingCase, handleImageUpload, c.uploadImages);
router.post('/cases/:id/images', id, url('image_url'), c.addImage);
router.delete('/images/:imageId', param('imageId').isInt({ min: 1 }), c.deleteImage);
router.post('/cases/:id/videos', id, url('video_url'), text('title', 255), c.addVideo);
router.post('/cases/:id/videos/upload', c.requireExistingCase, handleVideoUpload, c.uploadVideo);
router.delete('/videos/:videoId', param('videoId').isInt({ min: 1 }), c.deleteVideo);
router.get('/tests', c.listTests);
router.post('/tests', c.createTest);
router.post('/tests/shuffle', c.shuffleTests);
router.delete('/tests/:testId', param('testId').isInt({ min: 1 }), c.deleteTest);
router.post('/tests/:testId/questions/add', param('testId').isInt({ min: 1 }), body('caseId').isInt({ min: 1 }).withMessage('Choose a case.'), c.addTestQuestion);
router.delete('/tests/:testId/questions/:questionId', param('testId').isInt({ min: 1 }), param('questionId').isInt({ min: 1 }), c.removeTestQuestion);
router.put('/tests/:testId/questions', param('testId').isInt({ min: 1 }), body('caseIds').isArray({ max: 100 }).withMessage('caseIds must be an array.'), body('caseIds.*').isInt({ min: 1 }), c.setTestQuestions);
router.get('/ai-status', c.getAiStatus);
router.post('/retrain-ai', c.retrainAi);

module.exports = router;
