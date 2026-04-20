require('dotenv').config();

const app = require('./app');
const db = require('./db/knex');

const PORT = parseInt(process.env.PORT || '3000', 10);

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
