/**
 * Local + Cloud-DB backed image storage for case images.
 *
 * Files live in server/uploads/cases/ for fast disk serving AND are backed up
 * in `stored_files` in MySQL/TiDB (chunked at 2.5 MB per row so even 10 MB
 * scans stay well under TiDB Serverless's 6 MB single-row limit).
 * Ephemeral cloud hosts (like Render Free) never lose uploaded medical images
 * across restarts or deployments.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/db');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'cases');
const URL_PREFIX = '/uploads/cases/';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const CHUNK_BYTES = Math.floor(2.5 * 1024 * 1024); // 2.5 MB per DB row (safe for TiDB 6 MB row limit)

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
  if (typeof imageUrl !== 'string') return null;
  const cleanUrl = imageUrl.split('?')[0];
  let decoded = cleanUrl;
  try {
    decoded = decodeURIComponent(cleanUrl);
  } catch {
    decoded = cleanUrl;
  }
  if (!decoded.startsWith(URL_PREFIX)) return null;
  const name = decoded.slice(URL_PREFIX.length);
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

/** Best-effort delete of a stored local image by URL (including all DB backup chunks). */
async function removeByUrl(imageUrl) {
  const abs = urlToPath(imageUrl);
  if (abs) {
    await removePaths([abs]);
    const filename = path.basename(abs);
    pool
      .query('DELETE FROM stored_files WHERE filename = ? OR filename LIKE ?', [filename, `${filename}#%`])
      .catch(() => {});
  }
}

async function persistBufferToDb(filename, mime, buf) {
  await ensureStoredFilesTable();
  const totalChunks = Math.max(1, Math.ceil(buf.length / CHUNK_BYTES));

  for (let c = 0; c < totalChunks; c += 1) {
    const slice = buf.subarray(c * CHUNK_BYTES, (c + 1) * CHUNK_BYTES);
    const key = c === 0 ? filename : `${filename}#${c}`;
    const storedMime = c === 0 && totalChunks > 1 ? `${mime};chunks=${totalChunks}` : mime;

    let saved = false;
    for (let attempt = 0; attempt < 2 && !saved; attempt += 1) {
      try {
        await pool.query(
          `INSERT INTO stored_files (filename, mime_type, file_data) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE file_data = VALUES(file_data), mime_type = VALUES(mime_type)`,
          [key, storedMime, slice]
        );
        saved = true;
      } catch (err) {
        if (attempt === 1) throw err;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
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
    if (buf.length > 0) {
      const type = sniffImageType(buf) || { mime: 'image/jpeg', ext: 'jpg' };
      return { buffer: buf, mimeType: type.mime, filePath: abs };
    }
  } catch {
    // Not on local disk (e.g. Render ephemeral container restart) — restore from DB
  }

  await ensureStoredFilesTable();
  const filename = path.basename(abs);
  const [rows] = await pool.query(
    'SELECT mime_type, file_data FROM stored_files WHERE filename = ? LIMIT 1',
    [filename]
  );
  if (!rows[0] || !rows[0].file_data) {
    return null;
  }

  const rawMime = rows[0].mime_type || 'image/jpeg';
  const [cleanMime, chunkMeta] = rawMime.split(';chunks=');
  const totalChunks = chunkMeta ? Number(chunkMeta) : 1;

  const chunks = [
    Buffer.isBuffer(rows[0].file_data) ? rows[0].file_data : Buffer.from(rows[0].file_data),
  ];

  if (totalChunks > 1) {
    const partKeys = Array.from({ length: totalChunks - 1 }, (_, i) => `${filename}#${i + 1}`);
    const [partRows] = await pool.query(
      `SELECT filename, file_data FROM stored_files WHERE filename IN (${partKeys.map(() => '?').join(',')})`,
      partKeys
    );
    const partMap = new Map(
      partRows.map((r) => [
        r.filename,
        Buffer.isBuffer(r.file_data) ? r.file_data : Buffer.from(r.file_data),
      ])
    );
    for (const k of partKeys) {
      const partBuf = partMap.get(k);
      if (!partBuf) return null;
      chunks.push(partBuf);
    }
  }

  const fullBuffer = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
  // Cache back to local container disk so subsequent requests are served in <1ms
  await fs.promises.writeFile(abs, fullBuffer).catch(() => {});
  return { buffer: fullBuffer, mimeType: cleanMime || 'image/jpeg', filePath: abs };
}

/**
 * Validates freshly uploaded temp files (multer disk files), moves them to
 * their final content-derived names, and persists a chunked copy in `stored_files`.
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

      // Persist in DB (chunked) so cloud container restarts never wipe the image
      try {
        const buf = await fs.promises.readFile(dest);
        await persistBufferToDb(name, types[i].mime, buf);
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
