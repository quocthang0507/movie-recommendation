// File: mongo.js
const mongoose = require('mongoose');

// 👉 Dùng biến môi trường để giữ URI an toàn
const dbURL = process.env.MONGO_URI || 'mongodb://localhost:27017/movies_app';

const reviewSchema = new mongoose.Schema({
  movie_id: Number,
  user_id: Number,
  review_text: String,
  rating: Number,
  created_at: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', reviewSchema);

async function connectMongo() {
  try {
    await mongoose.connect(dbURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Đã kết nối MongoDB thành công!');
    return Review;
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error);
    throw error;
  }
}

module.exports = connectMongo;
