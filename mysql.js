const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'localhost',
  user: 'root', // Thay bằng username của bạn
  password: 'rootmysql', // Thay bằng mật khẩu của bạn
  database: 'movies_db'
});

module.exports = db;