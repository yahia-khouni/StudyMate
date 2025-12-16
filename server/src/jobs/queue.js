/**
 * Queue Configuration
 * BullMQ job queue setup with Redis
 */

const { Queue, Worker, QueueEvents } = require('bullmq');
const logger = require('../config/logger');

// Redis connection options
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// Queue names
const QUEUE_NAMES = {
  DOCUMENT_PROCESSING: 'document-processing',
  SUMMARY_GENERATION: 'summary-generation',
  QUIZ_GENERATION: 'quiz-generation',
  FLASHCARD_GENERATION: 'flashcard-generation',
  EMBEDDING_GENERATION: 'embedding-generation',
};

// Default job options
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // 5 seconds initial delay
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 100,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
};

// Queues storage
const queues = {};
const workers = {};
const queueEvents = {};

/**
 * Get or create a queue
 * @param {string} name
 * @returns {Queue}
 */
function getQueue(name) {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: redisConnection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    
    logger.info(`Queue created: ${name}`);
  }
  return queues[name];
}

/**
 * Get or create queue events
 * @param {string} name
 * @returns {QueueEvents}
 */
function getQueueEvents(name) {
  if (!queueEvents[name]) {
    queueEvents[name] = new QueueEvents(name, {
      connection: redisConnection,
    });
  }
  return queueEvents[name];
}

/**
 * Add a document processing job
 * @param {string} materialId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function addDocumentProcessingJob(materialId, data) {
  const queue = getQueue(QUEUE_NAMES.DOCUMENT_PROCESSING);
  
  const job = await queue.add(
    'process-document',
    {
      ...data,
      timestamp: Date.now(),
    },
    {
      jobId: `doc-${materialId}`,
      priority: 1,
    }
  );
  
  logger.info(`Document processing job added: ${job.id}`);
  
  // Track job in database
  const JobModel = require('../models/job.model');
  await JobModel.create({
    jobId: job.id,
    jobType: 'document_processing',
    entityType: 'material',
    entityId: materialId,
  });
  
  return job;
}

/**
 * Add a summary generation job
 * @param {string} chapterId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function addSummaryGenerationJob(chapterId, data) {
  const queue = getQueue(QUEUE_NAMES.SUMMARY_GENERATION);
  
  const job = await queue.add(
    'generate-summary',
    {
      ...data,
      timestamp: Date.now(),
    },
    {
      jobId: `summary-${chapterId}-${Date.now()}`,
      priority: 2,
    }
  );
  
  logger.info(`Summary generation job added: ${job.id}`);
  
  const JobModel = require('../models/job.model');
  await JobModel.create({
    jobId: job.id,
    jobType: 'summary_generation',
    entityType: 'chapter',
    entityId: chapterId,
  });
  
  return job;
}

/**
 * Add an embedding generation job
 * @param {string} chapterId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function addEmbeddingGenerationJob(chapterId, data) {
  const queue = getQueue(QUEUE_NAMES.EMBEDDING_GENERATION);
  
  const job = await queue.add(
    'generate-embeddings',
    {
      ...data,
      timestamp: Date.now(),
    },
    {
      jobId: `embed-${chapterId}-${Date.now()}`,
      priority: 3,
    }
  );
  
  logger.info(`Embedding generation job added: ${job.id}`);
  
  const JobModel = require('../models/job.model');
  await JobModel.create({
    jobId: job.id,
    jobType: 'embedding_generation',
    entityType: 'chapter',
    entityId: chapterId,
  });
  
  return job;
}

/**
 * Get job status
 * @param {string} queueName
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
async function getJobStatus(queueName, jobId) {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);
  
  if (!job) return null;
  
  const state = await job.getState();
  const progress = job.progress;
  
  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    attemptsMade: job.attemptsMade,
  };
}

/**
 * Get queue stats
 * @param {string} queueName
 * @returns {Promise<Object>}
 */
async function getQueueStats(queueName) {
  const queue = getQueue(queueName);
  
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  
  return { waiting, active, completed, failed, delayed };
}

/**
 * Pause a queue
 * @param {string} queueName
 * @returns {Promise<void>}
 */
async function pauseQueue(queueName) {
  const queue = getQueue(queueName);
  await queue.pause();
  logger.info(`Queue paused: ${queueName}`);
}

/**
 * Resume a queue
 * @param {string} queueName
 * @returns {Promise<void>}
 */
async function resumeQueue(queueName) {
  const queue = getQueue(queueName);
  await queue.resume();
  logger.info(`Queue resumed: ${queueName}`);
}

/**
 * Close all queues and workers
 * @returns {Promise<void>}
 */
async function closeAll() {
  const closePromises = [];
  
  for (const [name, queue] of Object.entries(queues)) {
    closePromises.push(queue.close().then(() => logger.info(`Queue closed: ${name}`)));
  }
  
  for (const [name, worker] of Object.entries(workers)) {
    closePromises.push(worker.close().then(() => logger.info(`Worker closed: ${name}`)));
  }
  
  for (const [name, events] of Object.entries(queueEvents)) {
    closePromises.push(events.close().then(() => logger.info(`QueueEvents closed: ${name}`)));
  }
  
  await Promise.all(closePromises);
}

module.exports = {
  QUEUE_NAMES,
  getQueue,
  getQueueEvents,
  addDocumentProcessingJob,
  addSummaryGenerationJob,
  addEmbeddingGenerationJob,
  getJobStatus,
  getQueueStats,
  pauseQueue,
  resumeQueue,
  closeAll,
  redisConnection,
};
