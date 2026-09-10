const Bull = require('bull');


const redisHost = process.env.REDIS_HOST || 'localhost';
const isUrl = redisHost.startsWith('redis://') || redisHost.startsWith('rediss://');
const redisUrl = process.env.REDIS_URL || (isUrl ? redisHost : null);

const studentImportQueue = new Bull('student-import', {
  redis: redisUrl || {
    host: redisHost,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 50,
    timeout: 15 * 60 * 1000, // 15 min timeout for large files
  },
});

module.exports = studentImportQueue;
