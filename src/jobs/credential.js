const Bull = require('bull');
const { getBullRedisConfig } = require('../utils/bullConfig');

const credentialQueue = new Bull('credential-dispatch', {
  redis: getBullRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
    timeout: 3 * 60 * 1000,
  },
});

credentialQueue.on('error', (err) => {
  console.error('[Bull:credential-dispatch] Redis/Queue error:', err.message);
});

module.exports = credentialQueue;
