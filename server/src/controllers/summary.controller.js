/**
 * Summary Controller
 * Handles HTTP requests for chapter summaries
 */

const summaryService = require('../services/summary.service');
const logger = require('../config/logger');

/**
 * Get summary for a chapter
 * GET /api/chapters/:chapterId/summary
 */
async function getSummary(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { language } = req.query;
    
    // Default to 'en' if not specified
    const targetLanguage = language || 'en';
    
    const summary = await summaryService.getSummary(chapterId, targetLanguage);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found. Generate one first.',
      });
    }
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Get summary error:', error);
    next(error);
  }
}

/**
 * Get all summaries for a chapter (both languages)
 * GET /api/chapters/:chapterId/summaries
 */
async function getChapterSummaries(req, res, next) {
  try {
    const { chapterId } = req.params;
    
    const summaries = await summaryService.getChapterSummaries(chapterId);
    
    res.json({
      success: true,
      data: summaries,
    });
  } catch (error) {
    logger.error('Get chapter summaries error:', error);
    next(error);
  }
}

/**
 * Generate a summary for a chapter
 * POST /api/chapters/:chapterId/summary/generate
 */
async function generateSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    const { language } = req.body;
    
    const summary = await summaryService.generateSummary(chapterId, userId, language);
    
    res.status(201).json({
      success: true,
      message: 'Summary generated successfully',
      data: summary,
    });
  } catch (error) {
    logger.error('Generate summary error:', error);
    next(error);
  }
}

/**
 * Regenerate an existing summary
 * POST /api/summaries/:summaryId/regenerate
 */
async function regenerateSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const { summaryId } = req.params;
    
    const summary = await summaryService.regenerateSummary(summaryId, userId);
    
    res.json({
      success: true,
      message: 'Summary regenerated successfully',
      data: summary,
    });
  } catch (error) {
    logger.error('Regenerate summary error:', error);
    next(error);
  }
}

/**
 * Delete a summary
 * DELETE /api/summaries/:summaryId
 */
async function deleteSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const { summaryId } = req.params;
    
    await summaryService.deleteSummary(summaryId, userId);
    
    res.json({
      success: true,
      message: 'Summary deleted successfully',
    });
  } catch (error) {
    logger.error('Delete summary error:', error);
    next(error);
  }
}

module.exports = {
  getSummary,
  getChapterSummaries,
  generateSummary,
  regenerateSummary,
  deleteSummary,
};
