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
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };

const pool = mysql.createPool(poolConfig);

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
