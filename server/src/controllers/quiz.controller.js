/**
 * Quiz Controller
 * Handles HTTP requests for quizzes and quiz attempts
 */

const quizService = require('../services/quiz.service');
const logger = require('../config/logger');

/**
 * Get a quiz by ID
 * GET /api/quizzes/:quizId
 */
async function getQuiz(req, res, next) {
  try {
    const { quizId } = req.params;
    
    const quiz = await quizService.getQuiz(quizId);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
    }
    
    res.json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    logger.error('Get quiz error:', error);
    next(error);
  }
}

/**
 * Get all quizzes for a chapter
 * GET /api/chapters/:chapterId/quizzes
 */
async function getChapterQuizzes(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { language } = req.query;
    
    const quizzes = await quizService.getChapterQuizzes(chapterId, language);
    
    res.json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    logger.error('Get chapter quizzes error:', error);
    next(error);
  }
}

/**
 * Get all quizzes for a course
 * GET /api/courses/:courseId/quizzes
 */
async function getCourseQuizzes(req, res, next) {
  try {
    const { courseId } = req.params;
    
    const quizzes = await quizService.getCourseQuizzes(courseId);
    
    res.json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    logger.error('Get course quizzes error:', error);
    next(error);
  }
}

/**
 * Generate a quiz for a chapter
 * POST /api/chapters/:chapterId/quiz/generate
 */
async function generateQuiz(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    const { language, difficulty, questionCount } = req.body;
    
    const quiz = await quizService.generateQuiz(chapterId, userId, {
      language,
      difficulty,
      questionCount,
    });
    
    res.status(201).json({
      success: true,
      message: 'Quiz generated successfully',
      data: quiz,
    });
  } catch (error) {
    logger.error('Generate quiz error:', error);
    next(error);
  }
}

/**
 * Submit a quiz attempt
 * POST /api/quizzes/:quizId/attempt
 */
async function submitAttempt(req, res, next) {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;
    const { answers, timeTakenSeconds } = req.body;
    
    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Answers must be an array',
      });
    }
    
    const attempt = await quizService.submitAttempt(quizId, userId, answers, timeTakenSeconds);
    
    res.status(201).json({
      success: true,
      message: attempt.passed ? 'Congratulations! You passed!' : 'Quiz completed. Keep practicing!',
      data: attempt,
    });
  } catch (error) {
    logger.error('Submit attempt error:', error);
    next(error);
  }
}

/**
 * Get quiz attempt review
 * GET /api/quiz-attempts/:attemptId/review
 */
async function getAttemptReview(req, res, next) {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;
    
    const review = await quizService.getAttemptReview(attemptId, userId);
    
    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    logger.error('Get attempt review error:', error);
    next(error);
  }
}

/**
 * Get user's quiz attempts
 * GET /api/quiz-attempts
 */
async function getUserAttempts(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId, limit } = req.query;
    
    const attempts = await quizService.getUserAttempts(userId, {
      courseId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    
    res.json({
      success: true,
      data: attempts,
    });
  } catch (error) {
    logger.error('Get user attempts error:', error);
    next(error);
  }
}

/**
 * Get user's best attempt for a quiz
 * GET /api/quizzes/:quizId/best-attempt
 */
async function getBestAttempt(req, res, next) {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;
    
    const attempt = await quizService.getBestAttempt(quizId, userId);
    
    res.json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    logger.error('Get best attempt error:', error);
    next(error);
  }
}

/**
 * Get user's quiz statistics
 * GET /api/quiz-stats
 */
async function getUserStats(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.query;
    
    const stats = await quizService.getUserStats(userId, courseId);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get user quiz stats error:', error);
    next(error);
  }
}

/**
 * Delete a quiz
 * DELETE /api/quizzes/:quizId
 */
async function deleteQuiz(req, res, next) {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;
    
    await quizService.deleteQuiz(quizId, userId);
    
    res.json({
      success: true,
      message: 'Quiz deleted successfully',
    });
  } catch (error) {
    logger.error('Delete quiz error:', error);
    next(error);
  }
}

module.exports = {
  getQuiz,
  getChapterQuizzes,
  getCourseQuizzes,
  generateQuiz,
  submitAttempt,
  getAttemptReview,
  getUserAttempts,
  getBestAttempt,
  getUserStats,
  deleteQuiz,
};
