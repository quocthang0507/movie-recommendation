const { createClient } = require('redis');

async function connectRedis() {
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: true, // Enable TLS for secure connection
      rejectUnauthorized: false, // Optional: Disable strict SSL verification (use with caution)
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('Max retries reached, Redis unavailable');
          return new Error('Max retries reached');
        }
        console.log(`Retrying to connect to Redis (${retries + 1}/10)...`);
        return Math.min(retries * 100, 2000); // Delay up to 2 seconds
      }
    }
  });

  client.on('connect', () => console.log('Redis client is connected 🔌'));
  client.on('ready', () => console.log('Redis client is ready ✅'));
  client.on('end', () => console.log('Redis connection closed ❌'));
  client.on('error', (err) => console.error('Redis error:', err));

  try {
    console.log('Trying to connect to Redis at Upstash');
    await client.connect();
    console.log('Connected to Redis successfully');
    return client;
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    throw err;
  }
}

module.exports = connectRedis;
