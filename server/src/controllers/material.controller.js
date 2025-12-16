/**
 * Material Controller
 * Handles HTTP requests for material operations (file uploads)
 */

const materialService = require('../services/material.service');
const logger = require('../config/logger');

/**
 * Upload a material (document) to a chapter
 * POST /api/courses/:courseId/chapters/:chapterId/materials
 */
async function uploadMaterial(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }
    
    const material = await materialService.createMaterial(
      chapterId,
      userId,
      req.file
    );
    
    res.status(201).json({
      success: true,
      message: 'Material uploaded successfully. Start processing manually when ready.',
      data: material,
    });
  } catch (error) {
    logger.error('Upload material error:', error);
    next(error);
  }
}

/**
 * Get all materials for a chapter
 * GET /api/courses/:courseId/chapters/:chapterId/materials
 */
async function getChapterMaterials(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    
    const materials = await materialService.listMaterials(chapterId, userId);
    
    res.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    logger.error('Get chapter materials error:', error);
    next(error);
  }
}

/**
 * Get a specific material
 * GET /api/courses/:courseId/chapters/:chapterId/materials/:materialId
 */
async function getMaterial(req, res, next) {
  try {
    const userId = req.user.id;
    const { materialId } = req.params;
    
    const material = await materialService.getMaterial(materialId, userId);
    
    res.json({
      success: true,
      data: material,
    });
  } catch (error) {
    logger.error('Get material error:', error);
    next(error);
  }
}

/**
 * Delete a material
 * DELETE /api/courses/:courseId/chapters/:chapterId/materials/:materialId
 */
async function deleteMaterial(req, res, next) {
  try {
    const userId = req.user.id;
    const { materialId } = req.params;
    
    await materialService.deleteMaterial(materialId, userId);
    
    res.json({
      success: true,
      message: 'Material deleted successfully',
    });
  } catch (error) {
    logger.error('Delete material error:', error);
    next(error);
  }
}

/**
 * Get processing status for a material
 * GET /api/courses/:courseId/chapters/:chapterId/materials/:materialId/status
 */
async function getMaterialStatus(req, res, next) {
  try {
    const userId = req.user.id;
    const { materialId } = req.params;
    
    const material = await materialService.getMaterial(materialId, userId);
    
    res.json({
      success: true,
      data: {
        id: material.id,
        status: material.status,
        file_name: material.originalFilename,
      },
    });
  } catch (error) {
    logger.error('Get material status error:', error);
    next(error);
  }
}

/**
 * Start processing a material synchronously
 * POST /api/courses/:courseId/chapters/:chapterId/materials/:materialId/process
 * 
 * This is a blocking operation - the response will be returned when processing completes
 * The response includes full processing details: extracted text, chunks, embeddings info
 */
async function processMaterial(req, res, next) {
  try {
    const userId = req.user.id;
    const { materialId } = req.params;
    
    logger.info(`Starting sync processing for material: ${materialId}`);
    
    const result = await materialService.processMaterial(materialId, userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Material processed successfully',
        data: result,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Material processing failed',
        data: result,
      });
    }
  } catch (error) {
    logger.error('Process material error:', error);
    next(error);
  }
}

/**
 * Reset a material to pending status (allows reprocessing)
 * POST /api/courses/:courseId/chapters/:chapterId/materials/:materialId/reset
 */
async function resetMaterial(req, res, next) {
  try {
    const userId = req.user.id;
    const { materialId } = req.params;
    
    const material = await materialService.resetMaterial(materialId, userId);
    
    res.json({
      success: true,
      message: 'Material reset to pending status',
      data: material,
    });
  } catch (error) {
    logger.error('Reset material error:', error);
    next(error);
  }
}

/**
 * Get detailed processing result for a material
 * GET /api/courses/:courseId/chapters/:chapterId/materials/:materialId/result
 */
async function getProcessingResult(req, res, next) {
  try {
    const userId = req.user.id;
    const { materialId } = req.params;
    
    const result = await materialService.getProcessingResult(materialId, userId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Get processing result error:', error);
    next(error);
  }
}

module.exports = {
  uploadMaterial,
  getChapterMaterials,
  getMaterial,
  deleteMaterial,
  getMaterialStatus,
  processMaterial,
  resetMaterial,
  getProcessingResult,
};
