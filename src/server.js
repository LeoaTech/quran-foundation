require('dotenv').config();

const app = require('./app');
const db = require('./db/knex');

const PORT = parseInt(process.env.PORT || '3000', 10);

// In single-container free tier or production web services, run background workers inline unless explicitly disabled.
const runInline = process.env.RUN_WORKER_INLINE === 'true' ||
  (process.env.RUN_WORKER_INLINE !== 'false' && (process.env.RENDER === 'true' || process.env.NODE_ENV === 'production'));

if (runInline) {
  console.log('[Startup] Starting background workers inline...');
  require('./workers/whatsappWorker');
  require('./workers/studentImportWorker');
  require('./workers/profileImageWorker');
}

async function start() {
  try {
    await db.raw('SELECT 1');
    console.log('Database connection established.');

    app.listen(PORT, () => {
      console.log(`QF LMS API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
