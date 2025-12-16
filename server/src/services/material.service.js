/**
 * Material Service
 * Business logic for material management
 */

const MaterialModel = require('../models/material.model');
const ChapterModel = require('../models/chapter.model');
const CourseModel = require('../models/course.model');
const { deleteFile, getFileInfo } = require('./upload.service');
const documentService = require('./document.service');
const logger = require('../config/logger');

// Max storage per user: 10GB (effectively unlimited for development)
const MAX_USER_STORAGE = 10 * 1024 * 1024 * 1024;

/**
 * Create material from uploaded file
 * @param {string} chapterId
 * @param {string} userId
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>}
 */
async function createMaterial(chapterId, userId, file) {
  // Verify chapter ownership
  const chapter = await ChapterModel.findByIdWithCourse(chapterId);
  
  if (!chapter || chapter.course.userId !== userId) {
    // Delete uploaded file
    await deleteFile(file.path);
    const error = new Error('Chapter not found');
    error.statusCode = 404;
    throw error;
  }
  
  // Storage limit check disabled for development
  // const currentStorage = await MaterialModel.getTotalSizeByUser(userId);
  // if (currentStorage + file.size > MAX_USER_STORAGE) {
  //   await deleteFile(file.path);
  //   const error = new Error(`Storage limit exceeded. Maximum: ${MAX_USER_STORAGE / (1024 * 1024)}MB`);
  //   error.statusCode = 400;
  //   throw error;
  // }
  
  // Create material record
  const fileInfo = getFileInfo(file);
  const material = await MaterialModel.create({
    chapterId,
    ...fileInfo,
  });
  
  // Material created in 'pending' status - processing must be started manually
  logger.info(`Material created: ${material.id} for chapter ${chapterId} (pending processing)`);
  
  return material;
}

/**
 * Create multiple materials from uploaded files
 * @param {string} chapterId
 * @param {string} userId
 * @param {Array} files - Multer file objects
 * @returns {Promise<Array>}
 */
async function createMaterials(chapterId, userId, files) {
  const materials = [];
  const errors = [];
  
  for (const file of files) {
    try {
      const material = await createMaterial(chapterId, userId, file);
      materials.push(material);
    } catch (error) {
      errors.push({ filename: file.originalname, error: error.message });
    }
  }
  
  return { materials, errors };
}

/**
 * Get material by ID with ownership check
 * @param {string} materialId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getMaterial(materialId, userId) {
  const material = await MaterialModel.findByIdWithChapter(materialId);
  
  if (!material || material.course.userId !== userId) {
    const error = new Error('Material not found');
    error.statusCode = 404;
    throw error;
  }
  
  return material;
}

/**
 * List materials for a chapter
 * @param {string} chapterId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function listMaterials(chapterId, userId) {
  // Verify chapter ownership
  const chapter = await ChapterModel.findByIdWithCourse(chapterId);
  
  if (!chapter || chapter.course.userId !== userId) {
    const error = new Error('Chapter not found');
    error.statusCode = 404;
    throw error;
  }
  
  return MaterialModel.findByChapter(chapterId);
}

/**
 * Delete a material
 * @param {string} materialId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteMaterial(materialId, userId) {
  const material = await getMaterial(materialId, userId);
  
  // Delete file
  await deleteFile(material.filePath);
  
  // Delete record
  await MaterialModel.remove(materialId);
  
  // Update chapter status
  const { updateChapterStatusFromMaterials } = require('./chapter.service');
  await updateChapterStatusFromMaterials(material.chapterId);
  
  logger.info(`Material deleted: ${materialId}`);
}

/**
 * Get user storage info
 * @param {string} userId
 * @returns {Promise<{used: number, limit: number, percentage: number}>}
 */
async function getUserStorageInfo(userId) {
  const used = await MaterialModel.getTotalSizeByUser(userId);
  return {
    used,
    limit: MAX_USER_STORAGE,
    percentage: Math.round((used / MAX_USER_STORAGE) * 100),
  };
}

/**
 * Retry processing for a failed material
 * @param {string} materialId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function retryProcessing(materialId, userId) {
  const material = await getMaterial(materialId, userId);
  
  if (material.status !== 'failed') {
    const error = new Error('Material is not in failed status');
    error.statusCode = 400;
    throw error;
  }
  
  // Reset material and process synchronously
  await documentService.resetMaterial(materialId);
  const result = await documentService.processDocumentSync(materialId);
  
  // Update chapter status based on processing result
  const { updateChapterStatusFromMaterials } = require('./chapter.service');
  await updateChapterStatusFromMaterials(material.chapterId);
  
  logger.info(`Material reprocessed: ${materialId}`, { success: result.success });
  
  return result;
}

/**
 * Process a material synchronously
 * @param {string} materialId
 * @param {string} userId
 * @returns {Promise<Object>} Processing result
 */
async function processMaterial(materialId, userId) {
  const material = await getMaterial(materialId, userId);
  
  if (material.status === 'processing') {
    const error = new Error('Material is already being processed');
    error.statusCode = 400;
    throw error;
  }
  
  if (material.status === 'completed') {
    const error = new Error('Material has already been processed. Use reset first to reprocess.');
    error.statusCode = 400;
    throw error;
  }
  
  // Update chapter status to processing
  await ChapterModel.updateStatus(material.chapterId, 'processing');
  
  // Process synchronously
  const result = await documentService.processDocumentSync(materialId);
  
  // Update chapter status based on result
  const { updateChapterStatusFromMaterials } = require('./chapter.service');
  await updateChapterStatusFromMaterials(material.chapterId);
  
  logger.info(`Material processed: ${materialId}`, { 
    success: result.success,
    processingTimeMs: result.processingTimeMs 
  });
  
  return result;
}

/**
 * Reset a material to allow reprocessing
 * @param {string} materialId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function resetMaterial(materialId, userId) {
  const material = await getMaterial(materialId, userId);
  
  if (material.status === 'processing') {
    const error = new Error('Cannot reset material while processing');
    error.statusCode = 400;
    throw error;
  }
  
  const result = await documentService.resetMaterial(materialId);
  
  // Update chapter status
  const { updateChapterStatusFromMaterials } = require('./chapter.service');
  await updateChapterStatusFromMaterials(material.chapterId);
  
  logger.info(`Material reset: ${materialId}`);
  
  return result;
}

/**
 * Get processing result details for a material
 * @param {string} materialId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getProcessingResult(materialId, userId) {
  // Verify ownership
  await getMaterial(materialId, userId);
  
  return documentService.getProcessingResult(materialId);
}

module.exports = {
  createMaterial,
  createMaterials,
  getMaterial,
  listMaterials,
  deleteMaterial,
  getUserStorageInfo,
  retryProcessing,
  processMaterial,
  resetMaterial,
  getProcessingResult,
  MAX_USER_STORAGE,
};
