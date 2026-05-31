require('dotenv').config();

const app = require('./app');
const db = require('./db/knex');

const PORT = parseInt(process.env.PORT || '3000', 10);

// In single-container free tier environments, run the background worker inline
if (process.env.RUN_WORKER_INLINE === 'true') {
  console.log('[Startup] RUN_WORKER_INLINE is true. Starting background worker inline...');
  require('./workers/whatsappWorker');
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

