const { validationResult } = require('express-validator');
const model = require('../models/caseAdminModel');
const testModel = require('../models/testModel');
const storage = require('../services/imageStorageService');

const wrap = (fn) => async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[admin] error:', err.message);
    res.status(500).json({ success: false, message: 'Request failed.' });
  }
};
const notFound = (res) => res.status(404).json({ success: false, message: 'Not found.' });

exports.listCases = wrap(async (req, res) =>
  res.json({ success: true, cases: await model.list({ status: req.query.status, systemId: req.query.systemId }) }));

exports.getCase = wrap(async (req, res) => {
  const c = await model.get(req.params.id);
  return c ? res.json({ success: true, case: c }) : notFound(res);
});

exports.createCase = wrap(async (req, res) => {
  const id = await model.create(req.body, req.user.id);
  res.status(201).json({ success: true, id });
});

exports.updateCase = wrap(async (req, res) => {
  if (!(await model.get(req.params.id))) return notFound(res);
  await model.update(req.params.id, req.body);
  res.json({ success: true });
});

exports.setStatus = wrap(async (req, res) => {
  const { status } = req.body;
  if (status === 'published') {
    const c = await model.get(req.params.id);
    if (!c) return notFound(res);
    if (!c.correct_answer || !c.correct_answer.trim() || c.images.length === 0) {
      return res.status(400).json({ success: false, message: 'A published case needs an answer key and at least one image.' });
    }
  }
  return (await model.setStatus(req.params.id, status)) ? res.json({ success: true }) : notFound(res);
});

exports.deleteCase = wrap(async (req, res) => {
  const urls = await model.listImageUrlsForCase(req.params.id);
  if (!(await model.remove(req.params.id))) return notFound(res);
  await Promise.all(urls.map((u) => storage.removeByUrl(u))); // rows are gone (cascade); drop the files too
  return res.json({ success: true });
});

exports.addImage = wrap(async (req, res) =>
  res.status(201).json({ success: true, id: await model.addImage(req.params.id, req.body.image_url) }));
exports.deleteImage = wrap(async (req, res) => {
  const img = await model.getImage(req.params.imageId);
  if (!img || !(await model.removeImage(img.id))) return notFound(res);
  await storage.removeByUrl(img.image_url); // only deletes files inside uploads/cases
  return res.json({ success: true });
});

// Runs after multer. Validates file CONTENT, stores files, then records them in one transaction.
exports.uploadImages = async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ success: false, message: 'Choose at least one image to upload.' });
  }

  let urls;
  try {
    urls = await storage.finalizeUploads(files); // cleans up its own files on failure
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    console.error('[admin] upload finalize error:', err.message);
    return res.status(500).json({ success: false, message: 'The upload could not be stored.' });
  }

  try {
    const images = await model.addImages(req.params.id, urls);
    return res.status(201).json({ success: true, images });
  } catch (err) {
    await storage.removePaths(urls.map(storage.urlToPath)); // no orphaned files if the DB insert fails
    console.error('[admin] upload DB error:', err.message);
    return res.status(500).json({ success: false, message: 'The images could not be saved. Nothing was stored.' });
  }
};

// Rejects before any file is written if the case does not exist or the id is invalid.
exports.requireExistingCase = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Invalid id.' });
  try {
    if (!(await model.caseExists(id))) return res.status(404).json({ success: false, message: 'Not found.' });
    return next();
  } catch (err) {
    console.error('[admin] case lookup error:', err.message);
    return res.status(500).json({ success: false, message: 'Request failed.' });
  }
};
exports.addVideo = wrap(async (req, res) =>
  res.status(201).json({ success: true, id: await model.addVideo(req.params.id, req.body.video_url, req.body.title) }));

exports.uploadVideo = wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Choose a video file to upload.' });
  }
  const videoUrl = `/uploads/cases/${req.file.filename}`;
  const id = await model.addVideo(req.params.id, videoUrl, req.body.title || null);
  return res.status(201).json({ success: true, id, video_url: videoUrl });
});

exports.deleteVideo = wrap(async (req, res) =>
  (await model.removeVideo(req.params.videoId)) ? res.json({ success: true }) : notFound(res));

exports.setTestQuestions = wrap(async (req, res) => {
  const test = await testModel.getBlockById(req.params.testId);
  if (!test) return notFound(res);
  const ids = req.body.caseIds;
  if (new Set(ids).size !== ids.length) return res.status(400).json({ success: false, message: 'Duplicate cases in block.' });
  await model.setTestQuestions(test.id, ids);
  res.json({ success: true, count: ids.length });
});

exports.listTests = wrap(async (req, res) => {
  const data = await model.listBlocksWithQuestions();
  return res.json({ success: true, blocks: data.blocks, questionsPerBlock: data.questionsPerBlock });
});

exports.shuffleTests = wrap(async (req, res) => {
  await model.autoSyncBlocks({
    reshuffleAll: true,
    questionsPerBlock: req.body.questions_per_block,
  });
  const data = await model.listBlocksWithQuestions();
  return res.json({ success: true, blocks: data.blocks, questionsPerBlock: data.questionsPerBlock });
});

exports.createTest = wrap(async (req, res) => {
  const block = await model.createBlock({
    blockNumber: req.body.block_number,
    title: req.body.title,
    secondsPerQuestion: req.body.seconds_per_question,
  });
  return res.status(201).json({ success: true, block });
});

exports.deleteTest = wrap(async (req, res) => {
  const ok = await model.deleteBlock(req.params.testId);
  return ok ? res.json({ success: true }) : notFound(res);
});

const ADD_MESSAGES = {
  block_not_found: [404, 'Test block not found.'],
  case_not_found: [404, 'Case not found.'],
  not_published: [400, 'Only published cases can be added to a test.'],
  no_answer_key: [400, 'This case has no answer key, so it cannot be graded.'],
  duplicate: [409, 'This case is already in the block.'],
  block_full: [409, 'This block is already full.'],
};

exports.addTestQuestion = wrap(async (req, res) => {
  const r = await model.addTestQuestion(req.params.testId, req.body.caseId);
  if (!r.ok) { const [code, message] = ADD_MESSAGES[r.code]; return res.status(code).json({ success: false, message }); }
  return res.status(201).json({ success: true, id: r.id, questionOrder: r.question_order });
});

exports.removeTestQuestion = wrap(async (req, res) => {
  const r = await model.removeTestQuestion(req.params.testId, req.params.questionId);
  if (r.ok) return res.json({ success: true });
  return notFound(res);
});
