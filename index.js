const express = require('express');
const app = express();
const path = require('path');
const movieRoutes = require('./routes/movieRoutes');

// Middleware quan trọng
app.use(express.json()); // Parse JSON body (chỉ cần một lần)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware ghi log để debug tất cả request
app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.url);
  next();
});

// Đăng ký route API
app.use('/api/movies', movieRoutes);

// Route chính
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Xử lý lỗi 404 (nếu cần)
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Khởi động server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});