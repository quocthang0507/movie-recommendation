const express = require('express');
const router = express.Router();
const db = require('../mysql');
const driver = require('../neo4j');
const connectMongo = require('../mongo');
// const redis = require('../redis');
const connectRedis = require('../redis');
let redisClient;

// 1. GET tất cả phim
router.get('/', async (req, res) => {
  try {
    const [movies] = await db.query('SELECT * FROM Movies');
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Lượt xem & người dùng đã xem phim
router.get('/stats/:movieId', async (req, res) => {
  try {
    const movieId = req.params.movieId;

    const [viewCount] = await db.query(
      `SELECT COUNT(*) AS total_views FROM Favorites WHERE movie_id = ?`,
      [movieId]
    );

    const [users] = await db.query(
      `SELECT u.user_id, u.username 
       FROM Users u
       JOIN Favorites f ON u.user_id = f.user_id
       WHERE f.movie_id = ?`,
      [movieId]
    );

    res.json({
      total_views: viewCount[0].total_views,
      users: users
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Danh sách phim đã xem của người dùng
router.get('/user-movies/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const [movies] = await db.query(
      `SELECT m.movie_id, m.title, COUNT(*) AS view_count
       FROM Movies m
       JOIN Favorites f ON m.movie_id = f.movie_id
       WHERE f.user_id = ?
       GROUP BY m.movie_id, m.title`,
      [userId]
    );

    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Top / Bottom Movies và Users
router.get('/analytics/top-stats', async (req, res) => {
  try {
    const [topUsers] = await db.query(`
      SELECT u.user_id, u.username, COUNT(f.movie_id) as movies_watched
      FROM Users u
      JOIN Favorites f ON u.user_id = f.user_id
      GROUP BY u.user_id, u.username
      ORDER BY movies_watched DESC
      LIMIT 5
    `);

    const [bottomUsers] = await db.query(`
      SELECT u.user_id, u.username, COUNT(f.movie_id) as movies_watched
      FROM Users u
      LEFT JOIN Favorites f ON u.user_id = f.user_id
      GROUP BY u.user_id, u.username
      ORDER BY movies_watched ASC
      LIMIT 5
    `);

    const [topMovies] = await db.query(`
      SELECT m.movie_id, m.title, COUNT(f.user_id) as viewers
      FROM Movies m
      LEFT JOIN Favorites f ON m.movie_id = f.movie_id
      GROUP BY m.movie_id, m.title
      ORDER BY viewers DESC
      LIMIT 5
    `);

    const [bottomMovies] = await db.query(`
      SELECT m.movie_id, m.title, COUNT(f.user_id) as viewers
      FROM Movies m
      LEFT JOIN Favorites f ON m.movie_id = f.movie_id
      GROUP BY m.movie_id, m.title
      ORDER BY viewers ASC
      LIMIT 5
    `);

    res.json({
      top_users: topUsers,
      bottom_users: bottomUsers,
      top_movies: topMovies,
      bottom_movies: bottomMovies
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 6. Đồng bộ dữ liệu từ MySQL sang Neo4j
router.post('/sync-to-neo4j', async (req, res) => {
    const session = driver.session();
    try {
      let [movies] = await db.query('SELECT * FROM Movies');
      let [users] = await db.query('SELECT * FROM Users');
      let [favorites] = await db.query('SELECT * FROM Favorites');
      let [genres] = await db.query('SELECT * FROM Genres');
      let [directors] = await db.query('SELECT * FROM Directors');
  
      if (!movies.length) return res.status(404).json({ message: 'No movies found' });
  
      await session.run('MATCH (n) DETACH DELETE n');
  
      for (const movie of movies) {
        await session.run(
          `MERGE (m:Movie {movieId: $movieId})
           SET m.title = $title, m.release_date = $releaseDate`,
          {
            movieId: movie.movie_id,
            title: movie.title,
            releaseDate: movie.release_date ? movie.release_date.toISOString().split('T')[0] : null
          }
        );
  
        if (movie.genre_id) {
          await session.run(
            `MERGE (g:Genre {genreId: $genreId})
             WITH g
             MATCH (m:Movie {movieId: $movieId})
             MERGE (m)-[:HAS_GENRE]->(g)`,
            {
              genreId: movie.genre_id,
              movieId: movie.movie_id
            }
          );
        }
  
        if (movie.director_id) {
          await session.run(
            `MERGE (d:Director {directorId: $directorId})
             WITH d
             MATCH (m:Movie {movieId: $movieId})
             MERGE (m)-[:DIRECTED_BY]->(d)`,
            {
              directorId: movie.director_id,
              movieId: movie.movie_id
            }
          );
        }
      }
  
      for (const user of users) {
        await session.run(
          `MERGE (u:User {userId: $userId})
           SET u.username = $username`,
          {
            userId: user.user_id,
            username: user.username
          }
        );
      }
  
      for (const fav of favorites) {
        await session.run(
          `MATCH (u:User {userId: $userId})
           MATCH (m:Movie {movieId: $movieId})
           MERGE (u)-[:FAVORITE]->(m)`,
          {
            userId: fav.user_id,
            movieId: fav.movie_id
          }
        );
      }
  
      res.json({
        message: 'Data synced successfully',
        stats: {
          movies: movies.length,
          users: users.length,
          favorites: favorites.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Neo4j sync failed', details: error.message });
    } finally {
      await session.close();
    }
  });
  
// 7. Gợi ý phim cho user
// Định nghĩa route GET để lấy gợi ý phim cho user
router.get('/recommendations/:userId', async (req, res) => {
    // Tạo session Neo4j
    const session = driver.session();
    try {
      // Kiểm tra user tồn tại trong MySQL
      const [users] = await db.query('SELECT * FROM Users WHERE user_id = ?', [req.params.userId]);
      if (!users.length) return res.status(404).json({ message: 'User not found' });
  
      // Chạy truy vấn Neo4j để tìm các phim cùng thể loại mà user đã yêu thích
      const neo4jResult = await session.run(
        `MATCH (u:User {userId: $userId })-[:FAVORITE]->(m:Movie)-[:HAS_GENRE]->(g:Genre)
        MATCH (genreRec:Movie)-[:HAS_GENRE]->(g)
        WHERE NOT EXISTS {
         MATCH (u)-[:FAVORITE]->(genreRec)
            }
        RETURN DISTINCT genreRec.movieId AS movieId, genreRec.title AS title
        LIMIT 5`,
        { userId: (req.params.userId) }
      );
       movieIds = neo4jResult.records.map(record => record.get('movieId').toString());
       let movies = neo4jResult.records.map(record => record);
       console.log("movieID result", movieIds);
      console.log("movies result", movies);
  
      // Lấy danh sách movieId từ kết quả truy vấn Neo4j
    //   let movieIds = neo4jResult.records.map(record => record.get('movieId').toString());
  
    //   Nếu không có kết quả từ Neo4j, chạy truy vấn fallback để lấy các phim phổ biến
    if (movieIds.length === 0) {
        const fallback = await session.run(
          `MATCH (m:Movie)
           WHERE NOT EXISTS {
             MATCH (u:User {userId: $userId})-[:FAVORITE]->(m)
           }
           RETURN m.movieId AS movieId, COUNT(*) AS cnt
           ORDER BY cnt DESC
           LIMIT 5`,
          { userId: (req.params.userId) }
        );
        movieIds = fallback.records.map(record => record.get('movieId').toString());
        runQuery().catch(console.error);

      }
    
      // Nếu vẫn không có kết quả, trả về mảng rỗng
      if (!movieIds.length) return res.json([]);
  
      // Tạo placeholders cho câu truy vấn MySQL
      const placeholders = movieIds.map(() => '?').join(',');
      // Chạy truy vấn MySQL để lấy thông tin phim từ danh sách movieId
      const [recommendedMovies] = await db.query(
        `SELECT * FROM Movies WHERE movie_id IN (${placeholders})`,
        movieIds
      );
  
      // Trả về danh sách phim được gợi ý
      res.json(recommendedMovies || []);
    } catch (error) {
      // Xử lý lỗi và trả về mã trạng thái 500
      res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
      // Đóng session Neo4j
      await session.close();
    }
  });


router.post('/neo4j/seed', async (req, res) => {
    const session = driver.session();
  
    try {
      // Lấy dữ liệu từ MySQL
      const [movies] = await db.query('SELECT * FROM Movies');
      const [users] = await db.query('SELECT * FROM Users');
      const [favorites] = await db.query('SELECT * FROM Favorites');
      const [genres] = await db.query('SELECT * FROM Genres');
      const [directors] = await db.query('SELECT * FROM Directors');
  
      // Xóa dữ liệu cũ trong Neo4j
      await session.run('MATCH (n) DETACH DELETE n');
  
      // Tạo node cho Genres
      for (const genre of genres) {
        await session.run(
          `MERGE (g:Genre {genreId: $genreId})
           SET g.name = $name`,
          {
            genreId: genre.genre_id.toString(),
            name: genre.name
          }
        );
      }
  
      // Tạo node cho Directors
      for (const director of directors) {
        await session.run(
          `MERGE (d:Director {directorId: $directorId})
           SET d.name = $name`,
          {
            directorId: director.director_id.toString(),
            name: director.name
          }
        );
      }
  
      // Tạo node cho Movies và mối quan hệ
      for (const movie of movies) {
        await session.run(
          `MERGE (m:Movie {movieId: $movieId})
           SET m.title = $title, m.release_date = $release_date`,
          {
            movieId: movie.movie_id.toString(),
            title: movie.title,
            release_date: movie.release_date?.toISOString().split('T')[0] || null
          }
        );
  
        // Mối quan hệ Movie - HAS_GENRE
        await session.run(
          `MATCH (m:Movie {movieId: $movieId}), (g:Genre {genreId: $genreId})
           MERGE (m)-[:HAS_GENRE]->(g)`,
          {
            movieId: movie.movie_id.toString(),
            genreId: movie.genre_id.toString()
          }
        );
  
        // Mối quan hệ Movie - DIRECTED_BY
        await session.run(
          `MATCH (m:Movie {movieId: $movieId}), (d:Director {directorId: $directorId})
           MERGE (m)-[:DIRECTED_BY]->(d)`,
          {
            movieId: movie.movie_id.toString(),
            directorId: movie.director_id.toString()
          }
        );
      }
  
      // Tạo node cho Users
      for (const user of users) {
        await session.run(
          `MERGE (u:User {userId: $userId})
           SET u.username = $username`,
          {
            userId: user.user_id.toString(),
            username: user.username
          }
        );
      }
  
      // Tạo relationship FAVORITE
      for (const fav of favorites) {
        await session.run(
          `MATCH (u:User {userId: $userId}), (m:Movie {movieId: $movieId})
           MERGE (u)-[:FAVORITE]->(m)`,
          {
            userId: fav.user_id.toString(),
            movieId: fav.movie_id.toString()
          }
        );
      }
  
      res.json({ message: 'Seed dữ liệu từ MySQL sang Neo4j thành công' });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Neo4j seed failed', details: error.message });
    } finally {
      await session.close();
    }
  });
  
//  // 8. Lấy reviews của phim
// // Endpoint lấy reviews theo movie_id
// router.get('/:movie_id/reviews', async (req, res) => {
//   const movieId = parseInt(req.params.movie_id);
//   try {
//     // Kết nối MongoDB và lấy model Review
//     const Review = await connectMongo(); // Hàm này trả về model Review

//     // Tìm reviews trong MongoDB
//     const reviews = await Review.find({ movie_id: movieId }).exec();

//     // Lấy thông tin user từ MySQL
//     const mysqlConn = await db.getConnection();
//     const [users] = await mysqlConn.query('SELECT * FROM Users');
//     mysqlConn.release();

//     // Kết hợp dữ liệu
//     const combinedData = reviews.map(review => ({
//       username: users.find(u => u.user_id === review.user_id)?.username || 'Unknown',
//       review_text: review.review_text,
//       rating: review.rating,
//       created_at: review.created_at
//     }));

//     res.json(combinedData);
//   } catch (error) {
//     console.error('Lỗi:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// Thêm các require cần thiết ở đầu file

// Cập nhật endpoint reviews để tính toán độ phổ biến
// Cập nhật endpoint reviews
// Cập nhật endpoint reviews
// Thêm middleware để kết nối Redis trước khi xử lý route
router.use(async (req, res, next) => {
  try {
    if (!redisClient) {
      redisClient = await connectRedis();
    }
    next();
  } catch (err) {
    console.error('Redis connection error:', err);
    next(err);
  }
});

// Cập nhật endpoint reviews
router.get('/:movie_id/reviews', async (req, res) => {
  const movieId = parseInt(req.params.movie_id);
  try {
    const Review = await connectMongo();
    const reviews = await Review.find({ movie_id: movieId }).exec();
    const mysqlConn = await db.getConnection();
    const [users] = await mysqlConn.query('SELECT * FROM Users');
    
    let averageRating = 0;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      averageRating = totalRating / reviews.length;
      
      await mysqlConn.query(
        'UPDATE Movies SET popularity = ? WHERE movie_id = ?',
        [averageRating, movieId]
      );
      
      // Sử dụng Redis client mới
      await redisClient.zAdd('movie_popularity', {
        score: averageRating,
        value: movieId.toString()
      });
      await redisClient.expire('movie_popularity', 86400);
    }
    
    mysqlConn.release();

    const combinedData = reviews.map(review => ({
      username: users.find(u => u.user_id === review.user_id)?.username || 'Unknown',
      review_text: review.review_text,
      rating: review.rating,
      created_at: review.created_at
    }));

    res.json({
      reviews: combinedData,
      average_rating: averageRating.toFixed(2)
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật endpoint phim phổ biến
router.get('/top-movies', async (req, res) => {
  try {
    // Lấy top 10 phim từ Redis
    const popularMovieIds = await redisClient.zRange('movie_popularity', 0, 9, {
      REV: true
    });

    if (!popularMovieIds || popularMovieIds.length === 0) {
      const [movies] = await db.query(
        'SELECT * FROM Movies ORDER BY popularity DESC LIMIT 10'
      );
      return res.json(movies);
    }
    
    const placeholders = popularMovieIds.map(() => '?').join(',');
    const [movies] = await db.query(
      `SELECT * FROM Movies WHERE movie_id IN (${placeholders}) 
       ORDER BY FIELD(movie_id, ${placeholders})`,
      [...popularMovieIds, ...popularMovieIds]
    );
    
    res.json(movies);
  } catch (error) {
    console.error('Error getting popular movies:', error);
    res.status(500).json({ error: error.message });
  }
});


// 9. Thêm review mới
router.post('/reviews', async (req, res) => {
  try {
    const Review = await connectMongo();
    
    // Tạo review_id mới
    const latestReview = await Review.findOne().sort({ review_id: -1 });
    const newReviewId = latestReview ? latestReview.review_id + 1 : 1;
    
    // Tạo review mới
    const newReview = new Review({
      review_id: newReviewId,
      user_id: req.body.user_id,
      movie_id: req.body.movie_id,
      review_text: req.body.review_text,
      rating: req.body.rating,
      created_at: new Date()
    });
    
    await newReview.save();
    
    res.json({
      success: true,
      message: 'Review added successfully',
      review: newReview
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add review',
      details: error.message 
    });
  }
});
// Thêm vào phần đầu file, sau các require khác
const { escape } = require('mysql2');

// Thêm các route mới trước module.exports

// Tìm kiếm phim
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json([]);

    // Tìm kiếm trong MySQL
    const escapedQuery = escape(`%${query}%`);
    const [results] = await db.query(`
      SELECT 
        m.movie_id, 
        m.title, 
        m.release_date,
        d.name AS director_name,
        g.name AS genre_name
      FROM Movies m
      LEFT JOIN Directors d ON m.director_id = d.director_id
      LEFT JOIN Genres g ON m.genre_id = g.genre_id
      WHERE 
        m.title LIKE ${escapedQuery} OR
        d.name LIKE ${escapedQuery}
      LIMIT 10
    `);

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lưu lịch sử tìm kiếm vào Redis
router.post('/search-history', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    // Thêm vào Redis với timestamp làm score để sắp xếp
    const timestamp = Date.now();
    await redisClient.zAdd('search_history', {
      score: timestamp,
      value: query
    });

    // Giới hạn lịch sử 10 mục gần nhất
    await redisClient.zRemRangeByRank('search_history', 0, -11);

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving search history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy lịch sử tìm kiếm từ Redis
router.get('/search-history', async (req, res) => {
  try {
    // Lấy 10 mục gần nhất (sắp xếp theo thời gian giảm dần)
    const history = await redisClient.zRange('search_history', 0, 9, {
      REV: true
    });

    res.json(history || []);
  } catch (error) {
    console.error('Error getting search history:', error);
    res.status(500).json({ error: error.message });
  }
});
// 2. GET chi tiết phim theo ID
router.get('/:id', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM Movies WHERE movie_id = ?', [req.params.id]);
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Movie not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;