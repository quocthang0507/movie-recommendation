const Redis = require('ioredis');

// Sử dụng URL kết nối Redis
const REDIS_URL = 'ediss://:AUk8AAIjcDE4MTRlYTZmZjI2ZDg0MjI2YjM4YzlhNTRlZWY4ZTY0NXAxMA@related-dane-18748.upstash.io:6379';

const redisClient = new Redis(REDIS_URL);

redisClient.set('key', 'value', (err, result) => {
  if (err) {
    console.error('Lỗi khi set giá trị:', err);
  } else {
    console.log('Set giá trị thành công:', result);
  }
});

redisClient.get('key', (err, result) => {
  if (err) {
    console.error('Lỗi khi get giá trị:', err);
  } else {
    console.log('Giá trị:', result);
  }
});

