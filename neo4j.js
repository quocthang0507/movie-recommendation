const neo4j = require('neo4j-driver');
const driver = neo4j.driver(
  'bolt://localhost:7689', // Thay bằng URI của bạn
  neo4j.auth.basic('neo4j', 'neo4jdesktop'),
  {
    logging: {
      level: 'debug', // can be 'error', 'warn', 'info', or 'debug'
      logger: (level, message) => console.log(`${level}: ${message}`)
    }
  }
  
  
);

module.exports = driver;