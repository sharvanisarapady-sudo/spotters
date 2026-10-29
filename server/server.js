require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const { testConnection } = require('./config/db');
const { initDb } = require('./config/initDb');
const compressMiddleware = require('./middleware/compress');
const authRoutes = require('./routes/authRoutes');
const systemRoutes = require('./routes/systemRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const practiceRoutes = require('./routes/practiceRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const testRoutes = require('./routes/testRoutes');
const progressRoutes = require('./routes/progressRoutes');
const navigationAiRoutes = require('./routes/navigationAiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { requireAuth } = require('./middleware/authMiddleware');
const { describeConfig, trainModel } = require('./services/aiService');
const { readImageBuffer } = require('./services/imageStorageService');
const systemModel = require('./models/systemModel');
const testModel = require('./models/testModel');

// Prevent transient cloud socket resets or async errors from crashing the server process
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled Promise Rejection safely caught:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception safely caught:', err?.message || err);
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('[server] JWT_SECRET is missing or too short (min 16 chars). Set it in server/.env.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const PORT = process.env.PORT || 5000;

// ---- Core middleware ----
app.use(
  cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true,
    credentials: true,
  })
);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(compressMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- Health check / Keep-Alive endpoint ----
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Spotters.com API is running.', ts: Date.now() });
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

// Serve local uploaded scans with automatic cloud-DB fallback if Render wiped ephemeral disk
app.use(
  '/uploads',
  requireAuth,
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    immutable: true,
    dotfiles: 'deny',
    index: false,
    setHeaders: (res) => res.setHeader('Cache-Control', 'private, max-age=604800, immutable'),
  }),
  async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const loaded = await readImageBuffer(`/uploads${req.path}`);
    if (!loaded?.buffer) return res.status(404).end();
    res.setHeader('Content-Type', loaded.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
    return res.end(loaded.buffer);
  }
);

// ---- 404 handler for API routes ----
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found.' });
});

// ---- Serve built React frontend in production ----
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
  app.use(
    express.static(clientDistPath, {
      maxAge: '7d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ---- Centralized error handler ----
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

async function start() {
  console.log(`[ai] ${describeConfig()}`);
  app.listen(PORT, () => {
    console.log(`[server] Spotters.com API listening on http://localhost:${PORT}`);
  });

  const dbOk = await testConnection();
  if (!dbOk) {
    console.warn('[server] Starting without a confirmed database connection. Check your .env settings.');
  } else {
    await initDb();
    // Warm up RAM caches and train the Case-Bank & Medical Image AI Mentor model in background
    Promise.all([
      systemModel.findAllWithCaseCounts(),
      testModel.listBlocks(),
      trainModel({ force: true }),
    ]).catch((err) => console.warn('[server] Cache/AI warm-up warning:', err.message));
  }
}

start();

module.exports = app;
