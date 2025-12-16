/**
 * Document Processing Worker
 * Handles PDF and DOCX text extraction with AI-enhanced content analysis
 * Supports vision AI for diagrams/images and generates embeddings
 */

const { Worker } = require('bullmq');
const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../config/logger');
const MaterialModel = require('../models/material.model');
const ChapterModel = require('../models/chapter.model');
const JobModel = require('../models/job.model');
const { redisConnection, QUEUE_NAMES, addEmbeddingGenerationJob } = require('./queue');

// AI Services - imported conditionally to avoid errors if not configured
let aiService = null;
let embeddingService = null;
let notificationService = null;

try {
  aiService = require('../services/ai.service');
} catch (e) {
  logger.warn('AI service not available:', e.message);
}

try {
  embeddingService = require('../services/embedding.service');
} catch (e) {
  logger.warn('Embedding service not available:', e.message);
}

try {
  notificationService = require('../services/notification.service');
} catch (e) {
  logger.warn('Notification service not available:', e.message);
}

/**
 * Extract text from PDF file with page-by-page processing
 * Memory-optimized version that clears buffers after use
 * @param {string} filePath
 * @returns {Promise<{text: string, pages: Array, numPages: number}>}
 */
async function extractFromPdf(filePath) {
  let dataBuffer = null;
  let data = null;
  
  try {
    dataBuffer = await fs.readFile(filePath);
    
    // Parse PDF with limited options to reduce memory usage
    data = await pdf(dataBuffer, {
      max: 100, // Max pages to parse
      pagerender: null, // Don't render pages as images
    });
    
    // Clear buffer immediately after parsing
    dataBuffer = null;
    
    // Extract text and page count
    const text = data.text || '';
    const numPages = data.numpages || 1;
    
    // Try to split by page (pdf-parse doesn't give per-page content by default)
    // We'll approximate by splitting on form feeds or large gaps
    let pages = [];
    
    if (numPages > 1) {
      // Try to split by form feed character or large whitespace gaps
      const rawPages = text.split(/\f|\n{4,}/);
      pages = rawPages
        .map((pageText, idx) => ({
          pageNumber: idx + 1,
          text: pageText.trim(),
        }))
        .filter(p => p.text.length > 0);
    }
    
    // If we couldn't split, use the whole text as one page
    if (pages.length === 0) {
      pages = [{ pageNumber: 1, text: text.trim() }];
    }
    
    // Clear data reference
    const result = {
      text,
      pages,
      numPages,
      info: data.info || {},
    };
    
    data = null;
    
    // Force garbage collection hint
    if (global.gc) {
      global.gc();
    }
    
    return result;
  } catch (error) {
    // Clean up on error
    dataBuffer = null;
    data = null;
    throw error;
  }
}

/**
 * Extract text from DOCX file
 * @param {string} filePath
 * @returns {Promise<{text: string, pages: Array, numPages: number}>}
 */
async function extractFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  
  // DOCX doesn't have pages, so we'll split by section breaks or paragraphs
  const sections = text.split(/\n{3,}/).filter(s => s.trim().length > 0);
  
  const pages = sections.map((section, idx) => ({
    pageNumber: idx + 1,
    text: section.trim(),
  }));
  
  return {
    text,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text }],
    numPages: pages.length || 1,
    info: {},
  };
}

/**
 * Extract text from DOC (legacy format)
 * @param {string} filePath
 * @returns {Promise<{text: string, pages: Array, numPages: number}>}
 */
async function extractFromDoc(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    return {
      text,
      pages: [{ pageNumber: 1, text }],
      numPages: 1,
      info: {},
    };
  } catch (error) {
    throw new Error('Legacy .doc format not fully supported. Please convert to .docx');
  }
}

/**
 * Process document and extract text with AI enhancement
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>}
 */
async function processDocument(job) {
  const { materialId, chapterId, filePath, mimeType, courseLanguage } = job.data;
  
  logger.info(`Processing document: ${materialId}, type: ${mimeType}`);
  
  // Get material with chapter and course info for notifications
  const material = await MaterialModel.findByIdWithChapter(materialId);
  const userId = material?.course?.userId;
  
  // Update job status to processing
  await JobModel.markStarted(job.id);
  await MaterialModel.updateStatus(materialId, 'processing');
  
  // Emit initial progress
  if (notificationService && userId) {
    notificationService.emitJobProgress(userId, job.id, 5, 'started', { materialId });
  }
  
  try {
    // Update progress
    await job.updateProgress(10);
    
    // Check file exists
    await fs.access(filePath);
    
    if (notificationService && userId) {
      notificationService.emitJobProgress(userId, job.id, 10, 'extracting', { materialId });
    }
    
    await job.updateProgress(20);
    
    // Extract text based on mime type
    let extractionResult;
    
    if (mimeType === 'application/pdf') {
      extractionResult = await extractFromPdf(filePath);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractionResult = await extractFromDocx(filePath);
    } else if (mimeType === 'application/msword') {
      extractionResult = await extractFromDoc(filePath);
    } else {
      throw new Error(`Unsupported mime type: ${mimeType}`);
    }
    
    const { text: rawText, pages, numPages } = extractionResult;
    
    logger.info(`Extracted ${numPages} pages, raw text length: ${rawText.length}`);
    
    await job.updateProgress(40);
    
    if (notificationService && userId) {
      notificationService.emitJobProgress(userId, job.id, 40, 'processing_pages', { 
        materialId,
        totalPages: numPages,
      });
    }
    
    // Limit text size to prevent memory issues
    const MAX_TEXT_LENGTH = 50000; // ~50KB of text
    let processableText = rawText;
    if (rawText.length > MAX_TEXT_LENGTH) {
      logger.warn(`Text truncated from ${rawText.length} to ${MAX_TEXT_LENGTH} characters`);
      processableText = rawText.substring(0, MAX_TEXT_LENGTH);
    }
    
    // Try AI content structuring if available
    let enhancedContent = processableText;
    
    if (aiService && process.env.OPENROUTER_API_KEY && processableText.length >= 100) {
      try {
        logger.info('Performing AI content structuring...');
        enhancedContent = await aiService.structureContent(processableText, courseLanguage || 'en');
        
        await job.updateProgress(60);
        if (notificationService && userId) {
          notificationService.emitJobProgress(userId, job.id, 60, 'structuring', { materialId });
        }
      } catch (aiError) {
        logger.warn('AI structuring failed, using raw text:', aiError.message);
        enhancedContent = processableText;
      }
    }
    
    await job.updateProgress(70);
    
    // Clean up text
    let extractedText = enhancedContent
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract meaningful text from document');
    }
    
    await job.updateProgress(75);
    
    // Save extracted text
    await MaterialModel.update(materialId, {
      status: 'completed',
      extractedText,
    });
    
    await job.updateProgress(80);
    
    if (notificationService && userId) {
      notificationService.emitJobProgress(userId, job.id, 80, 'generating_embeddings', { materialId });
    }
    
    // Generate embeddings using the embedding service
    let chunksCreated = 0;
    
    if (embeddingService) {
      try {
        // Get course ID for embedding collection
        const chapter = await ChapterModel.findByIdWithCourse(chapterId);
        
        if (chapter && chapter.courseId) {
          const embeddingResult = await embeddingService.addDocumentEmbeddings(
            chapter.courseId,
            chapterId,
            materialId,
            extractedText
          );
          
          chunksCreated = embeddingResult.chunksAdded;
          logger.info(`Created ${chunksCreated} embedding chunks for material ${materialId}`);
        }
      } catch (embeddingError) {
        logger.error('Embedding generation failed:', embeddingError.message);
        // Continue without embeddings - they can be regenerated later
      }
    } else {
      // Fallback: Queue embedding generation for separate worker
      try {
        await addEmbeddingGenerationJob(chapterId, {
          chapterId,
          materialId,
          text: extractedText,
          language: courseLanguage,
        });
      } catch (embedError) {
        logger.warn('Failed to queue embedding generation:', embedError.message);
      }
    }
    
    await job.updateProgress(90);
    
    // Update chapter status and merge content
    const { updateChapterStatusFromMaterials } = require('../services/chapter.service');
    await updateChapterStatusFromMaterials(chapterId);
    
    // Check if all materials for this chapter are processed
    const chapterMaterials = await MaterialModel.findByChapter(chapterId);
    const allProcessed = chapterMaterials.every(m => m.status === 'completed');
    
    if (allProcessed && chapterMaterials.length > 0) {
      // Merge all material content for the chapter
      const mergedContent = chapterMaterials
        .map(m => m.extractedText)
        .filter(t => t && t.length > 0)
        .join('\n\n---\n\n');
      
      // Update chapter processed content
      await ChapterModel.update(chapterId, {
        processedContent: mergedContent,
        status: 'ready',
      });
      
      logger.info(`Chapter ${chapterId} fully processed with ${chapterMaterials.length} materials`);
      
      // Send completion notification - include courseId in the call
      if (notificationService && userId && material.chapter) {
        await notificationService.notifyProcessingComplete(
          userId,
          material.chapter.courseId, // Add courseId
          chapterId,
          material.chapter.title,
          material.course.name
        );
      }
    }
    
    await job.updateProgress(100);
    await JobModel.markCompleted(job.id);
    
    // Emit completion event
    if (notificationService && userId) {
      notificationService.emitJobComplete(userId, job.id, {
        materialId,
        textLength: extractedText.length,
        chunksCreated,
      });
    }
    
    logger.info(`Document processed successfully: ${materialId}, text length: ${extractedText.length}`);
    
    return {
      success: true,
      materialId,
      textLength: extractedText.length,
      chunksCreated,
      pagesProcessed: numPages,
    };
  } catch (error) {
    logger.error(`Document processing failed for ${materialId}:`, error);
    
    await MaterialModel.updateStatus(materialId, 'failed', error.message);
    await JobModel.markFailed(job.id, error.message);
    
    // Update chapter status
    const { updateChapterStatusFromMaterials } = require('../services/chapter.service');
    await updateChapterStatusFromMaterials(chapterId);
    
    // Send failure notification
    if (notificationService && userId && material?.chapter) {
      await notificationService.notifyProcessingFailed(userId, material.chapter.title, error.message);
    }
    
    // Emit failure event
    if (notificationService && userId) {
      notificationService.emitJobFailed(userId, job.id, error.message);
    }
    
    throw error;
  }
}

/**
 * Create and start the document processing worker
 * @returns {Worker}
 */
function createDocumentProcessingWorker() {
  const worker = new Worker(
    QUEUE_NAMES.DOCUMENT_PROCESSING,
    async (job) => {
      return processDocument(job);
    },
    {
      connection: redisConnection,
      concurrency: 2, // Process 2 documents at a time
      limiter: {
        max: 5,
        duration: 60000, // Max 5 jobs per minute (for API rate limits)
      },
    }
  );
  
  worker.on('completed', (job, result) => {
    logger.info(`Document job ${job.id} completed:`, result);
  });
  
  worker.on('failed', (job, error) => {
    logger.error(`Document job ${job?.id} failed:`, error.message);
  });
  
  worker.on('error', (error) => {
    logger.error('Document worker error:', error);
  });
  
  worker.on('progress', (job, progress) => {
    logger.debug(`Document job ${job.id} progress: ${progress}%`);
  });
  
  logger.info('Document processing worker started');
  
  return worker;
}

module.exports = {
  createDocumentProcessingWorker,
  processDocument,
  extractFromPdf,
  extractFromDocx,
};
