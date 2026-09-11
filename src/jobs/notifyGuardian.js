const Bull = require('bull');
const { getBullRedisConfig } = require('../utils/bullConfig');

const notifyGuardianQueue = new Bull('notify-guardian', {
  redis: getBullRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

notifyGuardianQueue.on('error', (err) => {
  console.error('[Bull:notify-guardian] Redis/Queue error:', err.message);
});

module.exports = notifyGuardianQueue;
