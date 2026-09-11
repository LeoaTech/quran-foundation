const Bull = require('bull');
const { getBullRedisConfig } = require('../utils/bullConfig');

const studentImportQueue = new Bull('student-import', {
  redis: getBullRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 50,
    timeout: 15 * 60 * 1000, // 15 min timeout for large files
  },
});

studentImportQueue.on('error', (err) => {
  console.error('[Bull:student-import] Redis/Queue error:', err.message);
});

module.exports = studentImportQueue;
