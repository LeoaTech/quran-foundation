const { createClient } = require('redis');

const isTLS = process.env.REDIS_TLS === 'true';
const redisHost = process.env.REDIS_HOST || 'localhost';
const isUrl = redisHost.startsWith('redis://') || redisHost.startsWith('rediss://');
const redisUrl = process.env.REDIS_URL || (isUrl ? redisHost : null);
const isRediss = redisUrl && redisUrl.startsWith('rediss://');

const client = redisUrl
  ? createClient({
      url: redisUrl,
      pingInterval: 10000,
      socket: {
        keepAlive: 5000,
        tls: isRediss || isTLS ? { rejectUnauthorized: false } : undefined,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    })
  : createClient({
      password: process.env.REDIS_PASSWORD || undefined,
      pingInterval: 10000,
      socket: {
        host: redisHost,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        tls: isTLS ? { rejectUnauthorized: false } : undefined,
        keepAlive: 5000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });

client.on('error', (err) => console.error('[Redis Client] Error:', err.message));

let connectPromise = null;

async function getRedis() {
  if (client.isOpen && client.isReady) return client;
  if (client.isOpen) return client; // Currently connecting/reconnecting

  if (!connectPromise) {
    connectPromise = client
      .connect()
      .catch((err) => {
        console.error('[Redis Client] Initial connect failed:', err.message);
      })
      .finally(() => {
        connectPromise = null;
      });
  }
  await connectPromise;
  return client;
}

module.exports = { getRedis };
