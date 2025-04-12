const mysql = require('mysql2/promise');

const db = mysql.createPool({
  uri: process.env.MYSQL_URL, // Đọc chuỗi kết nối từ biến môi trường
  ssl: {
    rejectUnauthorized: true // Tương đương --ssl-mode=VERIFY_IDENTITY
  }
});

module.exports = db;
