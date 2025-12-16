/**
 * Chapter Controller
 * Handles HTTP requests for chapter operations
 */

const chapterService = require('../services/chapter.service');
const logger = require('../config/logger');

/**
 * Create a new chapter in a course
 * POST /api/courses/:courseId/chapters
 */
async function createChapter(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    const chapterData = req.body;
    
    const chapter = await chapterService.createChapter(courseId, userId, chapterData);
    
    res.status(201).json({
      success: true,
      message: 'Chapter created successfully',
      data: chapter,
    });
  } catch (error) {
    logger.error('Create chapter error:', error);
    next(error);
  }
}

/**
 * Get all chapters for a course
 * GET /api/courses/:courseId/chapters
 */
async function getCourseChapters(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    
    const chapters = await chapterService.listChapters(courseId, userId);
    
    res.json({
      success: true,
      data: chapters,
    });
  } catch (error) {
    logger.error('Get course chapters error:', error);
    next(error);
  }
}

/**
 * Get a specific chapter
 * GET /api/courses/:courseId/chapters/:chapterId
 */
async function getChapter(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    
    const chapter = await chapterService.getChapter(chapterId, userId);
    
    res.json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    logger.error('Get chapter error:', error);
    next(error);
  }
}

/**
 * Update a chapter
 * PUT /api/courses/:courseId/chapters/:chapterId
 */
async function updateChapter(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    const updateData = req.body;
    
    const chapter = await chapterService.updateChapter(chapterId, userId, updateData);
    
    res.json({
      success: true,
      message: 'Chapter updated successfully',
      data: chapter,
    });
  } catch (error) {
    logger.error('Update chapter error:', error);
    next(error);
  }
}

/**
 * Delete a chapter
 * DELETE /api/courses/:courseId/chapters/:chapterId
 */
async function deleteChapter(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    
    await chapterService.deleteChapter(chapterId, userId);
    
    res.json({
      success: true,
      message: 'Chapter deleted successfully',
    });
  } catch (error) {
    logger.error('Delete chapter error:', error);
    next(error);
  }
}

/**
 * Reorder chapters in a course
 * PUT /api/courses/:courseId/chapters/reorder
 */
async function reorderChapters(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    const { chapterIds } = req.body;
    
    await chapterService.reorderChapters(courseId, userId, chapterIds);
    
    res.json({
      success: true,
      message: 'Chapters reordered successfully',
    });
  } catch (error) {
    logger.error('Reorder chapters error:', error);
    next(error);
  }
}

/**
 * Mark a chapter as complete
 * POST /api/courses/:courseId/chapters/:chapterId/complete
 */
async function markChapterComplete(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    
    const chapter = await chapterService.markChapterCompleted(chapterId, userId);
    
    res.json({
      success: true,
      message: 'Chapter marked as complete',
      data: chapter,
    });
  } catch (error) {
    logger.error('Mark chapter complete error:', error);
    next(error);
  }
}

module.exports = {
  createChapter,
  getCourseChapters,
  getChapter,
  updateChapter,
  deleteChapter,
  reorderChapters,
  markChapterComplete,
};
