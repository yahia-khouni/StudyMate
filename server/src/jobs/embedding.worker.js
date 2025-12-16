/**
 * Embedding Generation Worker
 * Handles vector embedding generation using BGE-M3 and storage in ChromaDB
 */

const { Worker } = require('bullmq');
const logger = require('../config/logger');
const JobModel = require('../models/job.model');
const ChapterModel = require('../models/chapter.model');
const MaterialModel = require('../models/material.model');
const { redisConnection, QUEUE_NAMES } = require('./queue');

// Services
let embeddingService = null;
let aiService = null;
let notificationService = null;

try {
  embeddingService = require('../services/embedding.service');
} catch (e) {
  logger.warn('Embedding service not available:', e.message);
}

try {
  aiService = require('../services/ai.service');
} catch (e) {
  logger.warn('AI service not available:', e.message);
}

try {
  notificationService = require('../services/notification.service');
} catch (e) {
  logger.warn('Notification service not available:', e.message);
}

/**
 * Generate embeddings for chapter content
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>}
 */
async function generateEmbeddings(job) {
  const { chapterId, materialId, text, language } = job.data;
  
  logger.info(`Generating embeddings for chapter: ${chapterId}`);
  
  // Update job status
  await JobModel.markStarted(job.id);
  await job.updateProgress(10);
  
  try {
    // Get chapter with course info
    const chapter = await ChapterModel.findByIdWithCourse(chapterId);
    
    if (!chapter || !chapter.courseId) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }
    
    const courseId = chapter.courseId;
    const userId = chapter.course?.userId;
    
    // Emit progress
    if (notificationService && userId) {
      notificationService.emitJobProgress(userId, job.id, 10, 'started', { 
        chapterId,
        materialId,
      });
    }
    
    await job.updateProgress(20);
    
    // Get content to embed
    let contentToEmbed = text;
    
    // If no text provided, get from material or chapter
    if (!contentToEmbed && materialId) {
      const material = await MaterialModel.findById(materialId);
      contentToEmbed = material?.extractedText;
    }
    
    if (!contentToEmbed && chapter.processedContent) {
      contentToEmbed = chapter.processedContent;
    }
    
    if (!contentToEmbed || contentToEmbed.length < 50) {
      throw new Error('No content available for embedding generation');
    }
    
    await job.updateProgress(30);
    
    if (notificationService && userId) {
      notificationService.emitJobProgress(userId, job.id, 30, 'chunking', { 
        chapterId,
        contentLength: contentToEmbed.length,
      });
    }
    
    // Generate embeddings using the embedding service
    if (!embeddingService) {
      throw new Error('Embedding service not available');
    }
    
    await job.updateProgress(50);
    
    if (notificationService && userId) {
      notificationService.emitJobProgress(userId, job.id, 50, 'generating', { chapterId });
    }
    
    // Add embeddings to ChromaDB
    const result = await embeddingService.addDocumentEmbeddings(
      courseId,
      chapterId,
      materialId,
      contentToEmbed
    );
    
    await job.updateProgress(90);
    
    // Mark job as completed
    await JobModel.markCompleted(job.id);
    
    // Emit completion
    if (notificationService && userId) {
      notificationService.emitJobComplete(userId, job.id, {
        chapterId,
        materialId,
        chunksCreated: result.chunksAdded,
        collection: result.collection,
      });
    }
    
    await job.updateProgress(100);
    
    logger.info(`Embeddings generated for chapter ${chapterId}: ${result.chunksAdded} chunks`);
    
    return {
      success: true,
      chapterId,
      materialId,
      chunksAdded: result.chunksAdded,
      collection: result.collection,
    };
  } catch (error) {
    logger.error(`Embedding generation failed for chapter ${chapterId}:`, error);
    
    // Mark job as failed
    await JobModel.markFailed(job.id, error.message);
    
    // Get user ID for notification
    const chapter = await ChapterModel.findByIdWithCourse(chapterId);
    const userId = chapter?.course?.userId;
    
    if (notificationService && userId) {
      notificationService.emitJobFailed(userId, job.id, error.message);
    }
    
    throw error;
  }
}

/**
 * Create and start the embedding generation worker
 * @returns {Worker}
 */
function createEmbeddingGenerationWorker() {
  const worker = new Worker(
    QUEUE_NAMES.EMBEDDING_GENERATION,
    async (job) => {
      return generateEmbeddings(job);
    },
    {
      connection: redisConnection,
      concurrency: 3, // Process 3 embedding jobs at a time
      limiter: {
        max: 20,
        duration: 60000, // Max 20 jobs per minute
      },
    }
  );
  
  worker.on('completed', (job, result) => {
    logger.info(`Embedding job ${job.id} completed:`, result);
  });
  
  worker.on('failed', (job, error) => {
    logger.error(`Embedding job ${job?.id} failed:`, error.message);
  });
  
  worker.on('error', (error) => {
    logger.error('Embedding worker error:', error);
  });
  
  worker.on('progress', (job, progress) => {
    logger.debug(`Embedding job ${job.id} progress: ${progress}%`);
  });
  
  logger.info('Embedding generation worker started');
  
  return worker;
}

module.exports = {
  createEmbeddingGenerationWorker,
  generateEmbeddings,
};
