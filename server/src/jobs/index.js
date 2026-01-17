/**
 * Jobs Index
 * Initialize and export all job queues and workers
 */

const { closeAll, QUEUE_NAMES, getQueueStats } = require('./queue');
const { createDocumentProcessingWorker } = require('./document.worker');
const { createEmbeddingGenerationWorker } = require('./embedding.worker');
const { initializeReminderWorker, scheduleReminderJobs } = require('./reminder.worker');
const logger = require('../config/logger');

let workers = {};
let initialized = false;

/**
 * Initialize all workers
 * Call this in the main server file
 */
async function initializeWorkers() {
  if (initialized) {
    logger.warn('Workers already initialized');
    return;
  }
  
  try {
    // Document processing worker
    workers.documentProcessing = createDocumentProcessingWorker();
    
    // Embedding generation worker
    workers.embeddingGeneration = createEmbeddingGenerationWorker();
    
    // Reminder worker (deadline + streak reminders)
    workers.reminder = initializeReminderWorker();
    
    // Schedule recurring reminder jobs
    await scheduleReminderJobs();
    
    initialized = true;
    logger.info('All workers initialized (document processing, embedding generation, reminders)');
  } catch (error) {
    logger.error('Failed to initialize workers:', error);
    // Don't throw - allow server to start without workers
  }
}

/**
 * Shutdown all workers gracefully
 */
async function shutdownWorkers() {
  if (!initialized) return;
  
  logger.info('Shutting down workers...');
  
  for (const [name, worker] of Object.entries(workers)) {
    try {
      await worker.close();
      logger.info(`Worker ${name} closed`);
    } catch (error) {
      logger.error(`Error closing worker ${name}:`, error);
    }
  }
  
  await closeAll();
  initialized = false;
  workers = {};
  
  logger.info('All workers shut down');
}

/**
 * Get all queue stats
 */
async function getAllQueueStats() {
  const stats = {};
  
  for (const [key, name] of Object.entries(QUEUE_NAMES)) {
    try {
      stats[key] = await getQueueStats(name);
    } catch (error) {
      stats[key] = { error: error.message };
    }
  }
  
  return stats;
}

/**
 * Check if workers are healthy
 */
function isHealthy() {
  if (!initialized) return false;
  
  for (const worker of Object.values(workers)) {
    if (!worker.isRunning()) return false;
  }
  
  return true;
}

module.exports = {
  initializeWorkers,
  shutdownWorkers,
  getAllQueueStats,
  isHealthy,
  QUEUE_NAMES,
};
