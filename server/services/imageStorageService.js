/**
 * Local image storage for case images.
 *
 * Files live in server/uploads/cases/ and are served at /uploads/cases/<name>.
 * The database stores only that relative URL (case_images.image_url), so moving
 * to cloud storage later means changing this module and the stored URLs only.
 *
 * Security notes
 *  - File names are generated here (UUID + extension derived from the file's
 *    CONTENT); nothing from the client ever reaches the file system path.
 *  - Type is decided from magic bytes, never from the browser-supplied MIME
 *    type or extension.
 *  - Deletion only touches files that resolve inside UPLOAD_DIR.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'cases');
const URL_PREFIX = '/uploads/cases/';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Detects JPEG / PNG / WebP from a header buffer. Returns {ext, mime} or null. */
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

async function sniffFile(filePath) {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await fh.read(buf, 0, 16, 0);
    return sniffImageType(buf.subarray(0, bytesRead));
  } finally {
    await fh.close();
  }
}

/** Resolves a stored URL to an absolute path, or null if it is not a safe local upload. */
function urlToPath(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith(URL_PREFIX)) return null;
  const name = imageUrl.slice(URL_PREFIX.length);
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('.')) return null;
  const abs = path.resolve(UPLOAD_DIR, name);
  return abs.startsWith(UPLOAD_DIR + path.sep) ? abs : null;
}

/** Best-effort delete of absolute paths (never throws). */
async function removePaths(paths) {
  await Promise.all(
    paths.filter(Boolean).map((p) => fs.promises.unlink(p).catch(() => {}))
  );
}

/** Best-effort delete of a stored local image by URL; external URLs are left alone. */
async function removeByUrl(imageUrl) {
  const abs = urlToPath(imageUrl);
  if (abs) await removePaths([abs]);
}

/**
 * Validates freshly uploaded temp files (multer disk files) and moves them to
 * their final, content-derived names.
 * All-or-nothing: on any failure every temp/final file from this call is removed.
 * @returns {Promise<string[]>} stored URLs, in the same order as `files`
 * @throws {Error & {status:number}} validation errors (status 400)
 */
async function finalizeUploads(files) {
  const tempPaths = files.map((f) => f.path);
  const finalPaths = [];
  try {
    const types = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) throw httpError(413, `"${safeName(f)}" is larger than 10 MB.`);
      const type = await sniffFile(f.path);
      if (!type) throw httpError(400, `"${safeName(f)}" is not a valid JPEG, PNG or WebP image.`);
      types.push(type);
    }

    const urls = [];
    for (let i = 0; i < files.length; i += 1) {
      const name = `${crypto.randomUUID()}.${types[i].ext}`;
      const dest = path.join(UPLOAD_DIR, name);
      await fs.promises.rename(files[i].path, dest);
      finalPaths.push(dest);
      urls.push(URL_PREFIX + name);
    }
    return urls;
  } catch (err) {
    await removePaths([...tempPaths, ...finalPaths]);
    throw err;
  }
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Original name is used ONLY in an error message, stripped to harmless characters.
function safeName(file) {
  return String(file.originalname || 'file').replace(/[^\w.\- ]/g, '_').slice(0, 60);
}

module.exports = {
  UPLOAD_DIR,
  URL_PREFIX,
  MAX_FILE_BYTES,
  sniffImageType,
  urlToPath,
  removePaths,
  removeByUrl,
  finalizeUploads,
};
