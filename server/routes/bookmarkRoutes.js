const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const bookmarkController = require('../controllers/bookmarkController');

const router = express.Router();

router.get('/', requireAuth, bookmarkController.listBookmarks);
router.post('/:caseId', requireAuth, bookmarkController.addBookmark);
router.delete('/:caseId', requireAuth, bookmarkController.removeBookmark);

module.exports = router;
