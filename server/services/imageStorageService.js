/**
 * Local + Cloud-DB backed image storage for case images.
 *
 * Files live in server/uploads/cases/ for fast disk serving AND are backed up
 * in `stored_files` in MySQL/TiDB so ephemeral cloud hosts (like Render Free)
 * never lose uploaded medical images across restarts or deployments.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/db');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'cases');
const URL_PREFIX = '/uploads/cases/';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let storedFilesTableReady = false;
async function ensureStoredFilesTable() {
  if (storedFilesTableReady) return;
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS stored_files (
         filename VARCHAR(120) PRIMARY KEY,
         mime_type VARCHAR(60) NOT NULL,
         file_data LONGBLOB NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB`
    );
    storedFilesTableReady = true;
  } catch (err) {
    console.warn('[storage] stored_files table warning:', err.message);
  }
}

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
  if (abs) {
    await removePaths([abs]);
    const filename = path.basename(abs);
    pool.query('DELETE FROM stored_files WHERE filename = ?', [filename]).catch(() => {});
  }
}

/**
 * Reads an uploaded image buffer + mimeType from local disk cache or restores it from DB if missing.
 */
async function readImageBuffer(imageUrl) {
  const abs = urlToPath(imageUrl);
  if (!abs) return null;

  try {
    const buf = await fs.promises.readFile(abs);
    const type = sniffImageType(buf) || { mime: 'image/jpeg', ext: 'jpg' };
    return { buffer: buf, mimeType: type.mime, filePath: abs };
  } catch {
    // Not on local disk (e.g. Render ephemeral container restart) — try restoring from DB
  }

  try {
    await ensureStoredFilesTable();
    const filename = path.basename(abs);
    const [rows] = await pool.query(
      'SELECT mime_type, file_data FROM stored_files WHERE filename = ? LIMIT 1',
      [filename]
    );
    if (rows[0] && rows[0].file_data) {
      const buf = Buffer.isBuffer(rows[0].file_data)
        ? rows[0].file_data
        : Buffer.from(rows[0].file_data);
      await fs.promises.writeFile(abs, buf).catch(() => {});
      return { buffer: buf, mimeType: rows[0].mime_type || 'image/jpeg', filePath: abs };
    }
  } catch (err) {
    console.warn('[storage] DB image restore warning:', err.message);
  }
  return null;
}

/**
 * Validates freshly uploaded temp files (multer disk files), moves them to
 * their final content-derived names, and persists a copy in `stored_files` for durability.
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

    await ensureStoredFilesTable();

    const urls = [];
    for (let i = 0; i < files.length; i += 1) {
      const name = `${crypto.randomUUID()}.${types[i].ext}`;
      const dest = path.join(UPLOAD_DIR, name);
      await fs.promises.rename(files[i].path, dest);
      finalPaths.push(dest);
      urls.push(URL_PREFIX + name);

      // Persist in DB so cloud container restarts never wipe the image
      try {
        const buf = await fs.promises.readFile(dest);
        await pool.query(
          `INSERT INTO stored_files (filename, mime_type, file_data) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE file_data = VALUES(file_data), mime_type = VALUES(mime_type)`,
          [name, types[i].mime, buf]
        );
      } catch (dbErr) {
        console.warn('[storage] Could not persist backup blob in DB:', dbErr.message);
      }
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
  readImageBuffer,
  finalizeUploads,
};
