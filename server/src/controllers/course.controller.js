/**
 * Course Controller
 * Handles HTTP requests for course operations
 */

const courseService = require('../services/course.service');
const logger = require('../config/logger');

/**
 * Create a new course
 * POST /api/courses
 */
async function createCourse(req, res, next) {
  try {
    const userId = req.user.id;
    const courseData = req.body;
    
    const course = await courseService.createCourse(userId, courseData);
    
    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course,
    });
  } catch (error) {
    logger.error('Create course error:', error);
    next(error);
  }
}

/**
 * Get all courses for the authenticated user
 * GET /api/courses
 */
async function getUserCourses(req, res, next) {
  try {
    const userId = req.user.id;
    const { page, limit, sortBy, sortOrder } = req.query;
    
    const result = await courseService.listCourses(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sortBy,
      sortOrder,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Get user courses error:', error);
    next(error);
  }
}

/**
 * Get a specific course by ID
 * GET /api/courses/:courseId
 */
async function getCourse(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    
    const course = await courseService.getCourse(courseId, userId);
    
    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    logger.error('Get course error:', error);
    next(error);
  }
}

/**
 * Get course with chapters
 * GET /api/courses/:courseId/progress
 */
async function getCourseWithProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    
    const course = await courseService.getCourseWithChapters(courseId, userId);
    
    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    logger.error('Get course with progress error:', error);
    next(error);
  }
}

/**
 * Update a course
 * PUT /api/courses/:courseId
 */
async function updateCourse(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    const updateData = req.body;
    
    const course = await courseService.updateCourse(courseId, userId, updateData);
    
    res.json({
      success: true,
      message: 'Course updated successfully',
      data: course,
    });
  } catch (error) {
    logger.error('Update course error:', error);
    next(error);
  }
}

/**
 * Delete a course
 * DELETE /api/courses/:courseId
 */
async function deleteCourse(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    
    await courseService.deleteCourse(courseId, userId);
    
    res.json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    logger.error('Delete course error:', error);
    next(error);
  }
}

module.exports = {
  createCourse,
  getUserCourses,
  getCourse,
  getCourseWithProgress,
  updateCourse,
  deleteCourse,
};
