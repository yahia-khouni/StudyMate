require('dotenv').config();
const mysql = require('mysql2/promise');
const logger = require('./logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'studyai',
  password: process.env.DB_PASSWORD || 'studyai_password',
  database: process.env.DB_NAME || 'studyai',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test connection
pool
  .getConnection()
  .then((connection) => {
    logger.info('Database connected successfully');
    connection.release();
  })
  .catch((err) => {
    logger.error('Database connection failed:', err);
  });

module.exports = pool;
