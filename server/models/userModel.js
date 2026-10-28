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
      'SELECT id, full_name, email, role, is_active, created_at, institution, specialization, phone, location, daily_goal, bio FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  async updateProfile(id, { fullName, institution, specialization, phone, location, dailyGoal, bio }) {
    await pool.query(
      `UPDATE users
       SET full_name = COALESCE(?, full_name),
           institution = ?,
           specialization = ?,
           phone = ?,
           location = ?,
           daily_goal = ?,
           bio = ?
       WHERE id = ?`,
      [
        fullName ? fullName.trim() : null,
        institution ? institution.trim() : null,
        specialization ? specialization.trim() : null,
        phone ? phone.trim() : null,
        location ? location.trim() : null,
        Number(dailyGoal) > 0 ? Number(dailyGoal) : 10,
        bio ? bio.trim() : null,
        id,
      ]
    );
    return this.findById(id);
  },

  async create({ fullName, email, passwordHash, role = 'student' }) {
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [fullName, email, passwordHash, role]
    );
    return this.findById(result.insertId);
  },

  async hasAdmin() {
    const [[row]] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
    );
    return Number(row.count) > 0;
  },
};

module.exports = userModel;
