require('dotenv').config();
const mysql = require('mysql2/promise');

const useSsl =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  (process.env.DB_HOST && !['localhost', '127.0.0.1'].includes(process.env.DB_HOST));

const poolConfig = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spotters_db',
      waitForConnections: true,
      connectionLimit: 12,
      maxIdle: 6,
      idleTimeout: 45000,
      connectTimeout: 15000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: true,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };

const pool = mysql.createPool(poolConfig);

const TRANSIENT_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ECONNREFUSED',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
]);

function isTransientError(err) {
  if (!err) return false;
  if (TRANSIENT_CODES.has(err.code)) return true;
  if (err.errno === 1105 || err.errno === 1205 || err.errno === 1213) return true;
  const msg = String(err.message || '');
  return (
    msg.includes('Connection lost') ||
    msg.includes('closed state') ||
    msg.includes('WriteConflict') ||
    msg.includes('try again later')
  );
}

const rawQuery = pool.query.bind(pool);
pool.query = async function retryableQuery(...args) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await rawQuery(...args);
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === 2) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
    }
  }
  throw lastErr;
};

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[db] MySQL connection successful');
    return true;
  } catch (err) {
    if (err.code === 'ER_BAD_DB_ERROR' && !process.env.DATABASE_URL) {
      try {
        const dbName = (process.env.DB_NAME || 'spotters_db').replace(/[^a-zA-Z0-9_]/g, '');
        const bootstrapConn = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT) || 3306,
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
        });
        await bootstrapConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await bootstrapConn.end();
        console.log(`[db] Created database "${dbName}" automatically`);
        return true;
      } catch (createErr) {
        console.error('[db] Auto-create database failed:', createErr.message);
      }
    }
    console.error('[db] MySQL connection failed:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection };
