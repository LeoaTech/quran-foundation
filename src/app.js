require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      message_ur: 'بہت زیادہ درخواستیں، براہ کرم بعد میں دوبارہ کوشش کریں۔',
      status: 429,
    },
  },
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth',              require('./routes/auth'));
app.use('/api/v1',                   require('./routes/centers'));
app.use('/api/v1',                   require('./routes/users'));
app.use('/api/v1',                   require('./routes/courses'));
app.use('/api/v1',                   require('./routes/classes'));
app.use('/api/v1',                   require('./routes/enrollments'));
app.use('/api/v1',                   require('./routes/attendance'));
app.use('/api/v1',                   require('./routes/progress'));
app.use('/api/v1',                   require('./routes/assessments'));
app.use('/api/v1',                   require('./routes/reports'));

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      message_ur: 'مطلوبہ وسیلہ نہیں ملا۔',
      status: 404,
    },
  });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
      message_ur: err.message_ur || 'ایک غیر متوقع خرابی پیش آئی۔',
      status,
    },
  });
});

module.exports = app;
