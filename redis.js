const { createClient } = require('redis');

async function connectRedis() {
  const client = createClient({
    url: 'rediss://default:AUk8AAIjcDE4MTRlYTZmZjI2ZDg0MjI2YjM4YzlhNTRlZWY4ZTY0NXAxMA@related-dane-18748.upstash.io:6379',
    socket: {
      tls: true, // Kích hoạt TLS
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('Max retries reached, Redis unavailable');
          return new Error('Max retries reached');
        }
        console.log(`Retrying to connect to Redis (${retries + 1}/10)...`);
        return Math.min(retries * 100, 2000); // Delay tối đa 2 giây
      }
    }
  });

  client.on('connect', () => console.log('Redis client is connected 🔌'));
  client.on('ready', () => console.log('Redis client is ready ✅'));
  client.on('end', () => console.log('Redis connection closed ❌'));
  client.on('error', (err) => console.error('Redis error:', err));

  try {
    console.log('Trying to connect to Redis at rediss://default:AUk8AAIjcDE4MTRlYTZmZjI2ZDg0MjI2YjM4YzlhNTRlZWY4ZTY0NXAxMA@related-dane-18748.upstash.io:6379');
    await client.connect();
    console.log('Connected to Redis successfully');
    return client;
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    throw err;
  }
}

module.exports = connectRedis;
