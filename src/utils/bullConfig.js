const { URL } = require('url');

/**
 * Returns ioredis-compatible configuration for Bull queues.
 * Handles Upstash Redis rediss:// URLs, TLS, keepAlive, and readyCheck options.
 */
function getBullRedisConfig() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const isUrl = redisHost.startsWith('redis://') || redisHost.startsWith('rediss://');
  const redisUrl = process.env.REDIS_URL || (isUrl ? redisHost : null);

  if (redisUrl) {
    try {
      const u = new URL(redisUrl);
      const isTLS = u.protocol === 'rediss:' || process.env.REDIS_TLS === 'true';
      return {
        host: u.hostname,
        port: parseInt(u.port || '6379', 10),
        password: u.password ? decodeURIComponent(u.password) : undefined,
        tls: isTLS ? { rejectUnauthorized: false } : undefined,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        connectTimeout: 20000,
        keepAlive: 10000,
      };
    } catch {
      return redisUrl;
    }
  }

  const isTLS = process.env.REDIS_TLS === 'true';
  return {
    host: redisHost,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    connectTimeout: 20000,
    keepAlive: 10000,
  };
}

module.exports = { getBullRedisConfig };
