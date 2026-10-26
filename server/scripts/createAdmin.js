/**
 * Creates (or promotes) an admin/doctor account. Admins can use /api/admin.
 * Usage: node scripts/createAdmin.js "Full Name" email@example.com 'Password' [admin|doctor]
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

(async () => {
  const [name, email, password, role = 'admin'] = process.argv.slice(2);
  if (!name || !email || !password || !['admin', 'doctor'].includes(role) || password.length < 8) {
    console.error('Usage: node scripts/createAdmin.js "Full Name" email password(min 8) [admin|doctor]');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.length) {
      await pool.query('UPDATE users SET role = ?, password_hash = ? WHERE id = ?', [role, hash, existing[0].id]);
      console.log(`[admin] Updated ${email} -> ${role}`);
    } else {
      await pool.query('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email.toLowerCase(), hash, role]);
      console.log(`[admin] Created ${role} ${email}`);
    }
    process.exit(0);
  } catch (e) {
    console.error('[admin] failed:', e.message);
    process.exit(1);
  }
})();
