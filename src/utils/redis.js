const { createClient } = require('redis');

const isTLS = process.env.REDIS_TLS === 'true';
const redisHost = process.env.REDIS_HOST || 'localhost';

// Check if REDIS_HOST is a connection URL or if REDIS_URL is provided
const isUrl = redisHost.startsWith('redis://') || redisHost.startsWith('rediss://');
const redisUrl = process.env.REDIS_URL || (isUrl ? redisHost : null);

const client = redisUrl
  ? createClient({ 
      url: redisUrl,
      pingInterval: 10000, // Send a PING every 10s to prevent idle timeout
      socket: { keepAlive: 5000 } // Enable TCP Keep-Alive
    })
  : createClient({
      password: process.env.REDIS_PASSWORD || undefined,
      pingInterval: 10000,
      socket: {
        host: redisHost,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        tls: isTLS,
        keepAlive: 5000,
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
