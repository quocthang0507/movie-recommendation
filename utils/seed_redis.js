const redis = require('redis');
const { promisify } = require('util');
const db = require('../mysql');

const client = redis.createClient();

client.on('error', (err) => {
  console.error('Redis error:', err);
});

async function seedData() {
  try {
    await client.connect();
    console.log('Đã kết nối Redis thành công!');

    // Kiểm tra và tạo dữ liệu mẫu nếu bảng Movies trống
    const [check] = await db.query('SELECT COUNT(*) as count FROM Movies');
    if (check[0].count === 0) {
      await db.query(`
        INSERT INTO Movies (title, release_date) VALUES
        ('Inception', '2010-07-16', 95),
        ('The Dark Knight', '2008-07-18', 90),
        ('Interstellar', '2014-11-07', 85)
      `);
      console.log('Đã thêm dữ liệu mẫu vào MySQL');
    }

    // Lấy dữ liệu từ MySQL
    const [movies] = await db.query(`
      SELECT movie_id, title, IFNULL(popularity, 0) as popularity 
      FROM Movies LIMIT 10
    `);

    // Đồng bộ sang Redis
    for (const movie of movies) {
      await client.hSet(
        `popular_movies:${movie.movie_id}`,
        {
          movie_id: movie.movie_id.toString(),
          title: movie.title,
          popularity_score: movie.popularity.toString()
        }
      );
      console.log(`Đã thêm phim ${movie.movie_id} vào Redis`);
    }

    // Kiểm tra dữ liệu trong Redis
    const keys = await client.keys('popular_movies:*');
    for (const key of keys) {
      const data = await client.hGetAll(key);
      console.log(`${key}:`, data);
    }

  } catch (error) {
    console.error('Lỗi trong quá trình seed:', error);
  } finally {
    await client.quit();
    console.log('Đã đóng kết nối Redis');
  }
}

seedData();