const { ChromaClient } = require('chromadb');
const logger = require('./logger');

const chromaClient = new ChromaClient({
  path: `http://${process.env.CHROMA_HOST || 'localhost'}:${process.env.CHROMA_PORT || '8000'}`,
});

// Test connection
chromaClient
  .heartbeat()
  .then(() => {
    logger.info('ChromaDB connected successfully');
  })
  .catch((err) => {
    logger.error('ChromaDB connection failed:', err);
  });

module.exports = chromaClient;
