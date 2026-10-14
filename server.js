const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// ─── Middleware ───────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
};

app.use(cors({
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ─── MongoDB ──────────────────────────────────────────────────
// In serverless / Vercel, a cold start runs this once and the connection
// persists across warm invocations. Caching the promise avoids reconnect
// storms when many concurrent requests arrive.
let cachedConn = null;
const connectDB = async () => {
  if (cachedConn) {
    try { return await cachedConn; } catch { /* stale — reconnect below */ }
  }
  cachedConn = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 5
  });
  try {
    await cachedConn;
    console.log('MongoDB connected successfully');
    return cachedConn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    cachedConn = null;
    throw error;
  }
};

// Ensure the database is available before any route runs
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connect failed for request:', err.message);
    res.status(503).json({ success: false, message: 'Database unavailable. Please try again shortly.' });
  }
});


// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/learning-paths', require('./routes/learningPaths'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/study-sessions', require('./routes/studySessions'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/search', require('./routes/search'));

// Health check — works even without a DB connection
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Export for Vercel serverless; listen for local dev
module.exports = app;
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Arcstep server running on port ${PORT}`);
  });
}
