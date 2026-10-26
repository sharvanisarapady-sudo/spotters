const { pool } = require('../config/db');

const userModel = {
  async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  async create({ fullName, email, passwordHash, role = 'student' }) {
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [fullName, email, passwordHash, role]
    );
    return this.findById(result.insertId);
  },
};

module.exports = userModel;
