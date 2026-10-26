/**
 * Seeds exactly ONE demo student account so the app can be
 * demonstrated immediately after setup. This is structural/demo
 * data only — no case content is created here.
 *
 * Usage: node server/scripts/seedDemoUser.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const DEMO_USER = {
  fullName: 'Demo Student',
  email: 'demo@spotters.com',
  password: 'Demo@1234', // demo-only credential, printed to console below
};

async function seedDemoUser() {
  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [DEMO_USER.email]);
    if (existing.length > 0) {
      console.log(`[seed] Demo user already exists (${DEMO_USER.email}). Skipping.`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(DEMO_USER.password, 12);

    await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [DEMO_USER.fullName, DEMO_USER.email, passwordHash, 'student']
    );

    console.log('[seed] Demo student account created:');
    console.log(`        Email:    ${DEMO_USER.email}`);
    console.log(`        Password: ${DEMO_USER.password}`);
    process.exit(0);
  } catch (err) {
    console.error('[seed] Failed to seed demo user:', err.message);
    process.exit(1);
  }
}

seedDemoUser();
