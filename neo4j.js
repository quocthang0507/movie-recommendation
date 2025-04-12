const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  'neo4j+s://252a0996.databases.neo4j.io', // Neo4j Aura URI
  neo4j.auth.basic('neo4j', 'VzNxmbtYVfg2LzSjvZMM5nDiH9e_0APaeivSEGE6P8U'), // Replace with your Aura credentials
  {
    logging: {
      level: 'debug', // Can be 'error', 'warn', 'info', or 'debug'
      logger: (level, message) => console.log(`${level}: ${message}`)
    }
  }
);

module.exports = driver;
