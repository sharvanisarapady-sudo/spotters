require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { testConnection } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const systemRoutes = require('./routes/systemRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const practiceRoutes = require('./routes/practiceRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const testRoutes = require('./routes/testRoutes');
const progressRoutes = require('./routes/progressRoutes');
const navigationAiRoutes = require('./routes/navigationAiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const path = require('path');
const { requireAuth } = require('./middleware/authMiddleware');
const { describeConfig } = require('./services/aiService');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('[server] JWT_SECRET is missing or too short (min 16 chars). Set it in server/.env.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 5000;

// ---- Core middleware ----
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Spotters.com API is running.', phase: 'Phases 1-11' });
});

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/tests', testRoutes);

app.use('/api/progress', progressRoutes);
app.use('/api/navigation-ai', navigationAiRoutes);
app.use('/api/admin', adminRoutes);

// Locally stored case images (relative image_url like "/uploads/cases/x.jpg").
// Moving to cloud storage later only means changing the stored URLs.
// Login required: uploaded scans are not publicly browsable (file names are also random UUIDs).
app.use(
  '/uploads',
  requireAuth,
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1d',
    dotfiles: 'deny',
    index: false,
    setHeaders: (res) => res.setHeader('Cache-Control', 'private, max-age=86400'),
  })
);

// ---- 404 handler ----
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found.' });
});

// ---- Centralized error handler (never leaks internals) ----
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

async function start() {
  const dbOk = await testConnection();
  if (!dbOk) {
    console.warn('[server] Starting without a confirmed database connection. Check your .env settings.');
  }
  console.log(`[ai] ${describeConfig()}`);
  app.listen(PORT, () => {
    console.log(`[server] Spotters.com API listening on http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
