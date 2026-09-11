const Bull = require('bull');
const { getBullRedisConfig } = require('../utils/bullConfig');

const profileImageQueue = new Bull('profile-image', {
  redis: getBullRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
    timeout: 30000, // 30s per image
  },
});

profileImageQueue.on('error', (err) => {
  console.error('[Bull:profile-image] Redis/Queue error:', err.message);
});

module.exports = profileImageQueue;
