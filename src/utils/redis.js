const { createClient } = require('redis');

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
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
