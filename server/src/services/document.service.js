/**
 * Document Processing Service
 * Synchronous document processing for PDF and DOCX files
 * Extracts text, structures content with AI, and generates embeddings
 */

const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const MaterialModel = require('../models/material.model');
const ChapterModel = require('../models/chapter.model');
const aiService = require('./ai.service');
const embeddingService = require('./embedding.service');
const logger = require('../config/logger');

/**
 * Extract text from PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} Extracted text
 */
async function extractFromPdf(filePath) {
  logger.info(`Extracting text from PDF: ${filePath}`);
  
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  
  logger.info(`Extracted ${data.text.length} characters from PDF`);
  return data.text;
}

/**
 * Extract text from DOCX file
 * @param {string} filePath - Path to DOCX file
 * @returns {Promise<string>} Extracted text
 */
async function extractFromDocx(filePath) {
  logger.info(`Extracting text from DOCX: ${filePath}`);
  
  const dataBuffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: dataBuffer });
  
  if (result.messages && result.messages.length > 0) {
    logger.warn('DOCX extraction warnings:', result.messages);
  }
  
  logger.info(`Extracted ${result.value.length} characters from DOCX`);
  return result.value;
}

/**
 * Process a document synchronously
 * @param {string} materialId - Material ID to process
 * @param {Function} onProgress - Optional progress callback (stage, message, percentage)
 * @returns {Promise<Object>} Processing result with extracted text, chunks, and embeddings info
 */
async function processDocumentSync(materialId, onProgress = null) {
  const startTime = Date.now();
  const result = {
    success: false,
    materialId,
    stages: [],
    extractedTextLength: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    structuredContent: null,
    error: null,
    processingTimeMs: 0
  };
  
  const reportProgress = (stage, message, percentage) => {
    const stageInfo = { stage, message, percentage, timestamp: Date.now() };
    result.stages.push(stageInfo);
    logger.info(`[${stage}] ${message} (${percentage}%)`);
    if (onProgress) {
      onProgress(stage, message, percentage);
    }
  };
  
  try {
    // Stage 1: Load material
    reportProgress('LOAD', 'Loading material from database...', 5);
    
    const material = await MaterialModel.findById(materialId);
    if (!material) {
      throw new Error(`Material not found: ${materialId}`);
    }
    
    if (material.status === 'completed') {
      throw new Error('Material has already been processed');
    }
    
    // Update status to processing
    await MaterialModel.updateStatus(materialId, 'processing');
    
    reportProgress('LOAD', `Found material: ${material.originalFilename}`, 10);
    
    // Stage 2: Extract text
    reportProgress('EXTRACT', 'Extracting text from document...', 15);
    
    const filePath = path.resolve(material.filePath);
    let extractedText = '';
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }
    
    if (material.mimeType === 'application/pdf') {
      extractedText = await extractFromPdf(filePath);
    } else if (material.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await extractFromDocx(filePath);
    } else {
      throw new Error(`Unsupported file type: ${material.mimeType}`);
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text content extracted from document');
    }
    
    result.extractedTextLength = extractedText.length;
    reportProgress('EXTRACT', `Extracted ${extractedText.length} characters`, 30);
    
    // Update material with extracted text
    await MaterialModel.update(materialId, { extractedText });
    
    // Stage 3: AI Structuring
    reportProgress('STRUCTURE', 'Structuring content with AI...', 35);
    
    let structuredContent = null;
    try {
      structuredContent = await aiService.structureContent(extractedText);
      result.structuredContent = structuredContent;
      
      // Store structured content in database
      await MaterialModel.update(materialId, { structuredContent });
      
      reportProgress('STRUCTURE', 'Content structured successfully', 50);
    } catch (structureError) {
      logger.warn('AI structuring failed, continuing without:', structureError.message);
      reportProgress('STRUCTURE', `AI structuring skipped: ${structureError.message}`, 50);
    }
    
    // Stage 4: Chunking - done by embedding service
    reportProgress('CHUNK', 'Preparing for embedding generation...', 55);
    
    // Get chapter to find courseId for embedding storage
    const chapter = await ChapterModel.findById(material.chapterId);
    if (!chapter) {
      logger.warn('Chapter not found, skipping embeddings');
      result.chunksCreated = 0;
      result.embeddingsGenerated = 0;
    } else {
      // Stage 5: Generate and store embeddings
      // embedding.service handles chunking + embedding internally
      reportProgress('EMBED', 'Generating and storing embeddings...', 65);
      
      try {
        const embeddingResult = await embeddingService.addDocumentEmbeddings(
          chapter.courseId,
          material.chapterId,
          materialId,
          extractedText
        );
        
        result.chunksCreated = embeddingResult.chunksAdded || 0;
        result.embeddingsGenerated = embeddingResult.chunksAdded || 0;
        
        if (embeddingResult.error) {
          reportProgress('EMBED', `Embeddings completed with warning: ${embeddingResult.error}`, 95);
        } else if (embeddingResult.skipped) {
          reportProgress('EMBED', 'Embeddings skipped (ChromaDB not available)', 95);
        } else {
          reportProgress('STORE', `Stored ${result.embeddingsGenerated} embeddings`, 95);
        }
      } catch (embeddingError) {
        logger.error('Embedding generation failed:', embeddingError);
        reportProgress('EMBED', `Embedding failed: ${embeddingError.message}`, 95);
        // Continue - material can still be used without embeddings
        result.chunksCreated = 0;
        result.embeddingsGenerated = 0;
      }
    }
    
    // Stage 7: Complete - update status and set processedAt timestamp
    await MaterialModel.update(materialId, { 
      status: 'completed',
      processedAt: new Date()
    });
    
    result.success = true;
    result.processingTimeMs = Date.now() - startTime;
    reportProgress('COMPLETE', `Processing completed in ${(result.processingTimeMs / 1000).toFixed(2)}s`, 100);
    
    logger.info(`Document processing completed for ${materialId}`, {
      extractedTextLength: result.extractedTextLength,
      chunksCreated: result.chunksCreated,
      embeddingsGenerated: result.embeddingsGenerated,
      processingTimeMs: result.processingTimeMs
    });
    
    return result;
    
  } catch (error) {
    logger.error(`Document processing failed for ${materialId}:`, error);
    
    result.error = error.message;
    result.processingTimeMs = Date.now() - startTime;
    
    // Update material status to failed
    try {
      await MaterialModel.updateStatus(materialId, 'failed', error.message);
    } catch (updateError) {
      logger.error('Failed to update material status:', updateError);
    }
    
    reportProgress('ERROR', error.message, -1);
    
    return result;
  }
}

/**
 * Reset a material to pending status (allow reprocessing)
 * @param {string} materialId - Material ID to reset
 */
async function resetMaterial(materialId) {
  const material = await MaterialModel.findById(materialId);
  if (!material) {
    throw new Error(`Material not found: ${materialId}`);
  }
  
  // Clear embeddings from vector store
  try {
    const chapter = await ChapterModel.findById(material.chapterId);
    if (chapter) {
      await embeddingService.deleteMaterialEmbeddings(chapter.courseId, materialId);
    }
  } catch (err) {
    logger.warn('Could not clear embeddings:', err.message);
  }
  
  // Reset material status and clear extracted text
  await MaterialModel.update(materialId, {
    status: 'pending',
    processingError: null,
    extractedText: null
  });
  
  logger.info(`Material ${materialId} reset to pending status`);
  return MaterialModel.findById(materialId);
}

/**
 * Get processing result for a material (extracted text preview, chunks info)
 * @param {string} materialId - Material ID
 */
async function getProcessingResult(materialId) {
  const material = await MaterialModel.findById(materialId);
  if (!material) {
    throw new Error(`Material not found: ${materialId}`);
  }
  
  return {
    id: material.id,
    originalName: material.originalFilename,
    status: material.status,
    processingError: material.processingError,
    extractedTextPreview: material.extractedText 
      ? material.extractedText.substring(0, 1000) + (material.extractedText.length > 1000 ? '...' : '')
      : null,
    extractedTextLength: material.extractedText ? material.extractedText.length : 0,
    structuredContent: null
  };
}

module.exports = {
  extractFromPdf,
  extractFromDocx,
  processDocumentSync,
  resetMaterial,
  getProcessingResult
};
