
// const redis = require('redis');
// const { promisify } = require('util');

// const client = redis.createClient({
//   host: 'localhost', 
//   port: 6379,
// });

// client.on('error', (err) => {
//   console.error('Redis error:', err);
// });

// // Chuyển các hàm callback thành Promise
// const getAsync = promisify(client.get).bind(client);
// const setAsync = promisify(client.set).bind(client);
// const delAsync = promisify(client.del).bind(client);

// module.exports = {
//   client,
//   getAsync,
//   setAsync,
//   delAsync,
// };
// redis.js
// redis.js
// redis.js (phiên bản mới)
// redis.js
const { createClient } = require('redis');

async function connectRedis() {
  const client = createClient({
    url: 'redis://localhost:6379',
    socket: {
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
    console.log('Trying to connect to Redis at redis://localhost:6379');
    await client.connect();
    console.log('Connected to Redis successfully');
    return client;
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    throw err;
  }
}

module.exports = connectRedis;



module.exports = connectRedis;