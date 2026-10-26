const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const userModel = require('../models/userModel');
const { signToken } = require('../utils/token');
const { COOKIE_NAME } = require('../middleware/authMiddleware');

const SALT_ROUNDS = 12;

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { fullName, email, password } = req.body;

  try {
    const existing = await userModel.findByEmail(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // All new registrations are STUDENT accounts for now.
    // The Doctor/Contributor role is provisioned separately (future feature).
    const user = await userModel.create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'student',
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role, fullName: user.full_name });
    res.cookie(COOKIE_NAME, token, cookieOptions());

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[auth] register error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong while creating your account.' });
  }
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await userModel.findByEmail(email.toLowerCase().trim());
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, fullName: user.full_name });
    res.cookie(COOKIE_NAME, token, cookieOptions());

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong while logging in.' });
  }
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  return res.json({ success: true, message: 'Logged out successfully.' });
}

async function me(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user });
  } catch (err) {
    console.error('[auth] me error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load your profile.' });
  }
}

module.exports = { register, login, logout, me };
