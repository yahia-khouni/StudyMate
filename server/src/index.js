require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const passport = require('./config/passport');
const logger = require('./config/logger');
const { initializeWorkers, shutdownWorkers, isHealthy: workersHealthy } = require('./jobs');
const notificationService = require('./services/notification.service');

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize notification service with WebSocket
notificationService.initializeWebSocket(io);

// Make io accessible to routes
app.set('io', io);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Cookie parser
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 minutes
  message: { error: 'Too many attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (_req, res) => {
  // Check vector store connectivity (SQLite-based)
  let vectorStoreHealthy = false;
  try {
    const embeddingService = require('./services/embedding.service');
    vectorStoreHealthy = await embeddingService.verifyConnection();
  } catch (e) {
    // Vector store not available
  }
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    workers: workersHealthy() ? 'healthy' : 'unhealthy',
    vectorStore: vectorStoreHealthy ? 'connected' : 'disconnected',
    connectedClients: notificationService.getConnectedUserCount(),
  });
});

// Serve uploaded files statically (for authorized users)
const { getUploadDir } = require('./services/upload.service');
app.use('/uploads', express.static(getUploadDir()));

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/courses', require('./routes/course.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api', require('./routes/learning.routes'));

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize background workers
  initializeWorkers();
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Shutdown workers
    await shutdownWorkers();
    
    // Close database connections
    const pool = require('./config/database');
    await pool.end();
    logger.info('Database connections closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, io };
