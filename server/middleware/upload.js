const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { UPLOAD_DIR, MAX_FILE_BYTES } = require('../services/imageStorageService');

const MAX_FILES_PER_REQUEST = 10;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

// Temp files get a random name; the real name is assigned after content validation.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `tmp-${crypto.randomUUID()}`),
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = file.mimetype === 'video/webm' ? 'webm' : 'mp4';
    cb(null, `vid-${crypto.randomUUID()}.${ext}`);
  },
});

const videoUploader = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    const ok = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype);
    if (!ok) {
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      err.message = 'Only MP4, WebM, and MOV videos are allowed.';
      err.code = 'INVALID_TYPE';
      return cb(err);
    }
    return cb(null, true);
  },
}).single('video');

function handleVideoUpload(req, res, next) {
  videoUploader(req, res, (err) => {
    if (!err) return next();
    let status = 400;
    let message = 'Video upload failed.';
    if (err.code === 'INVALID_TYPE') message = err.message;
    else if (err.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'Video must be 100 MB or smaller.'; }
    return res.status(status).json({ success: false, message });
  });
}

const uploader = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_REQUEST, fields: 5 },
  // First-pass filter only. The authoritative check is magic-byte sniffing in
  // imageStorageService.finalizeUploads (the browser-supplied type can be faked).
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!ok) {
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      err.message = 'Only JPEG, PNG and WebP images are allowed.';
      err.code = 'INVALID_TYPE';
      return cb(err);
    }
    return cb(null, true);
  },
}).array('images', MAX_FILES_PER_REQUEST);

/** Runs multer and turns its errors into the API's JSON error format. */
function handleImageUpload(req, res, next) {
  uploader(req, res, (err) => {
    if (!err) return next();

    let status = 400;
    let message = 'Upload failed.';
    if (err.code === 'INVALID_TYPE') message = err.message;
    else if (err.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'Each image must be 10 MB or smaller.'; }
    else if (err.code === 'LIMIT_FILE_COUNT') message = `You can upload at most ${MAX_FILES_PER_REQUEST} images at a time.`;
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Unexpected upload field. Use the "images" field.';
    else {
      console.error('[upload] unexpected error:', err.code || err.message);
      status = 500;
      message = 'The upload could not be processed.';
    }
    // multer removes partially written files for most errors; sweep leftovers of this request.
    const leftovers = (req.files || []).map((f) => f.path);
    require('../services/imageStorageService').removePaths(leftovers);
    return res.status(status).json({ success: false, message });
  });
}

module.exports = { handleImageUpload, handleVideoUpload, MAX_FILES_PER_REQUEST };
