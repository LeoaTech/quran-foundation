const { createClient } = require('redis');

const isTLS = process.env.REDIS_TLS === 'true';
const redisHost = process.env.REDIS_HOST || 'localhost';

// Check if REDIS_HOST is a connection URL or if REDIS_URL is provided
const isUrl = redisHost.startsWith('redis://') || redisHost.startsWith('rediss://');
const redisUrl = process.env.REDIS_URL || (isUrl ? redisHost : null);

const client = redisUrl
  ? createClient({ url: redisUrl })
  : createClient({
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        host: redisHost,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        tls: isTLS,
      },
    });

client.on('error', (err) => console.error('Redis error:', err.message));

let connectPromise = null;

async function getRedis() {
  if (client.isOpen) return client;
  if (!connectPromise) {
    connectPromise = client.connect().finally(() => { connectPromise = null; });
  }
  await connectPromise;
  return client;
}

module.exports = { getRedis };
