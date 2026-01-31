/**
 * Progress Controller
 * HTTP handlers for progress tracking endpoints
 */

const progressService = require('../services/progress.service');
const logger = require('../config/logger');

/**
 * Get dashboard data
 * GET /api/progress/dashboard
 */
async function getDashboard(req, res, next) {
  try {
    const data = await progressService.getDashboardData(req.user.id);
    res.json(data);
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    next(error);
  }
}

/**
 * Get user-wide progress summary
 * GET /api/progress/user
 */
async function getUserProgress(req, res, next) {
  try {
    const data = await progressService.getUserProgress(req.user.id);
    res.json(data);
  } catch (error) {
    logger.error('Failed to get user progress:', error);
    next(error);
  }
}

/**
 * Get course progress details
 * GET /api/progress/courses/:courseId
 */
async function getCourseProgress(req, res, next) {
  try {
    const { courseId } = req.params;
    const data = await progressService.getCourseProgress(courseId, req.user.id);
    
    if (!data) {
      return res.status(404).json({ 
        message: 'Course not found or you do not have access' 
      });
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Failed to get course progress:', error);
    next(error);
  }
}

/**
 * Get chapter progress details
 * GET /api/progress/chapters/:chapterId
 */
async function getChapterProgress(req, res, next) {
  try {
    const { chapterId } = req.params;
    const data = await progressService.getChapterProgress(chapterId, req.user.id);
    
    if (!data) {
      return res.status(404).json({ 
        message: 'Chapter not found or you do not have access' 
      });
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Failed to get chapter progress:', error);
    next(error);
  }
}

/**
 * Get weekly activity summary
 * GET /api/progress/weekly
 */
async function getWeeklyActivity(req, res, next) {
  try {
    const data = await progressService.getWeeklyActivitySummary(req.user.id);
    res.json(data);
  } catch (error) {
    logger.error('Failed to get weekly activity:', error);
    next(error);
  }
}

module.exports = {
  getDashboard,
  getUserProgress,
  getCourseProgress,
  getChapterProgress,
  getWeeklyActivity,
};
