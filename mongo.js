// File: mongo.js
const mongoose = require('mongoose');

// Sử dụng URL kết nối từ MongoDB Atlas
const dbURL = 'mongodb://atlas-sql-67fa2d4703d57a001b56f0c6-nrd4f.a.query.mongodb.net/sample_mflix?ssl=true&authSource=admin';

// Tạo schema cho reviews (nếu chưa có)
const reviewSchema = new mongoose.Schema({
  movie_id: Number,
  user_id: Number,
  review_text: String,
  rating: Number,
  created_at: { type: Date, default: Date.now }
});

// Tạo model (đảm bảo tên collection là 'reviews')
const Review = mongoose.model('Review', reviewSchema);

// Hàm kết nối và trả về model Review
async function connectMongo() {
  try {
    await mongoose.connect(dbURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Đã kết nối MongoDB thành công!');
    return Review; // Trả về model để sử dụng trong route
  } catch (error) {
    console.error('Lỗi kết nối MongoDB:', error);
    throw error;
  }
}

// Export hàm connectMongo
module.exports = connectMongo;
