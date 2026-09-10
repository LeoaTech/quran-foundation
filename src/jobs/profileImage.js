const Bull = require('bull');

const redisHost = process.env.REDIS_HOST || 'localhost';
const isUrl = redisHost.startsWith('redis://') || redisHost.startsWith('rediss://');
const redisUrl = process.env.REDIS_URL || (isUrl ? redisHost : null);

const profileImageQueue = new Bull('profile-image', {
  redis: redisUrl || {
    host: redisHost,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
    timeout: 30000, // 30s per image
  },
});

module.exports = profileImageQueue;
