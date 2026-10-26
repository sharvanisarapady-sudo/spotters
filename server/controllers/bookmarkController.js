const bookmarkModel = require('../models/bookmarkModel');

async function addBookmark(req, res) {
  const { caseId } = req.params;

  try {
    const exists = await bookmarkModel.caseExists(caseId);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'This case is not available to bookmark.' });
    }
    await bookmarkModel.add(req.user.id, caseId);
    return res.json({ success: true, isBookmarked: true });
  } catch (err) {
    console.error('[bookmarks] add error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not bookmark this case.' });
  }
}

async function removeBookmark(req, res) {
  const { caseId } = req.params;

  try {
    await bookmarkModel.remove(req.user.id, caseId);
    return res.json({ success: true, isBookmarked: false });
  } catch (err) {
    console.error('[bookmarks] remove error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not remove this bookmark.' });
  }
}

async function listBookmarks(req, res) {
  try {
    const bookmarks = await bookmarkModel.listForUser(req.user.id);
    return res.json({ success: true, bookmarks });
  } catch (err) {
    console.error('[bookmarks] list error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load your bookmarks.' });
  }
}

module.exports = { addBookmark, removeBookmark, listBookmarks };
