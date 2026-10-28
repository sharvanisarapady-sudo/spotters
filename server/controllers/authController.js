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

async function adminStatus(req, res) {
  try {
    const adminExists = await userModel.hasAdmin();
    return res.json({ success: true, adminExists });
  } catch (err) {
    console.error('[auth] adminStatus error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not check admin status.' });
  }
}

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { fullName, email, password, role } = req.body;

  try {
    const existing = await userModel.findByEmail(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    let assignedRole = 'student';
    if (role === 'admin') {
      const adminAlreadyExists = await userModel.hasAdmin();
      if (adminAlreadyExists) {
        return res.status(403).json({
          success: false,
          message: 'An Admin (Radiologist) account has already been created. Only one Admin account is allowed — please register as a Student.',
        });
      }
      assignedRole = 'admin';
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await userModel.create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: assignedRole,
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role, fullName: user.full_name });
    res.cookie(COOKIE_NAME, token, cookieOptions());

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: { id: user.id, fullName: user.full_name, full_name: user.full_name, email: user.email, role: user.role },
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

  const { email, password, loginType } = req.body;

  try {
    const user = await userModel.findByEmail(email.toLowerCase().trim());
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (loginType === 'admin' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This is a Student account without Admin (Radiologist) rights. Please switch to the Student Login tab.',
      });
    }

    if (loginType === 'student' && user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This is the Admin (Radiologist) account. Please switch to the Admin Login tab.',
      });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, fullName: user.full_name });
    res.cookie(COOKIE_NAME, token, cookieOptions());

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      user: { id: user.id, fullName: user.full_name, full_name: user.full_name, email: user.email, role: user.role },
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

async function updateProfile(req, res) {
  try {
    const updated = await userModel.updateProfile(req.user.id, {
      fullName: req.body.full_name || req.body.fullName,
      institution: req.body.institution,
      specialization: req.body.specialization,
      phone: req.body.phone,
      location: req.body.location,
      dailyGoal: req.body.daily_goal ?? req.body.dailyGoal,
      bio: req.body.bio,
    });
    return res.json({ success: true, message: 'Profile updated successfully.', user: updated });
  } catch (err) {
    console.error('[auth] updateProfile error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not update your profile.' });
  }
}

module.exports = { adminStatus, register, login, logout, me, updateProfile };
