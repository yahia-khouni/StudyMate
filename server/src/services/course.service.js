/**
 * Course Service
 * Business logic for course management
 */

const CourseModel = require('../models/course.model');
const ChapterModel = require('../models/chapter.model');
const logger = require('../config/logger');

// Available course colors
const COURSE_COLORS = [
  '#6366f1', // Indigo (default)
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

/**
 * Create a new course
 * @param {string} userId
 * @param {Object} courseData
 * @returns {Promise<Object>}
 */
async function createCourse(userId, { title, name, description, syllabus, language, color }) {
  // Accept both title (from frontend) and name (legacy) - title takes precedence
  const courseName = title || name;
  
  // Validate color
  if (color && !COURSE_COLORS.includes(color)) {
    color = COURSE_COLORS[0];
  }
  
  const course = await CourseModel.create({
    userId,
    name: courseName,
    description,
    syllabus,
    language,
    color,
  });
  
  logger.info(`Course created: ${course.id} by user ${userId}`);
  
  return course;
}

/**
 * Get course by ID with ownership check
 * @param {string} courseId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getCourse(courseId, userId) {
  const course = await CourseModel.findByIdAndUser(courseId, userId);
  
  if (!course) {
    const error = new Error('Course not found');
    error.statusCode = 404;
    throw error;
  }
  
  return course;
}

/**
 * Get course with chapters
 * @param {string} courseId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getCourseWithChapters(courseId, userId) {
  const course = await getCourse(courseId, userId);
  const chapters = await ChapterModel.findByCourse(courseId);
  
  return {
    ...course,
    chapters,
  };
}

/**
 * List all courses for a user
 * @param {string} userId
 * @param {Object} options
 * @returns {Promise<{courses: Array, total: number, hasMore: boolean}>}
 */
async function listCourses(userId, { page = 1, limit = 20, sortBy = 'updated_at', sortOrder = 'DESC' } = {}) {
  const offset = (page - 1) * limit;
  
  const [courses, total] = await Promise.all([
    CourseModel.findByUser(userId, { limit, offset, sortBy, sortOrder }),
    CourseModel.countByUser(userId),
  ]);
  
  return {
    courses,
    total,
    page,
    limit,
    hasMore: offset + courses.length < total,
  };
}

/**
 * Update a course
 * @param {string} courseId
 * @param {string} userId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateCourse(courseId, userId, { title, name, description, syllabus, language, color }) {
  // Verify ownership
  await getCourse(courseId, userId);
  
  // Accept both title (from frontend) and name (legacy) - title takes precedence
  const courseName = title !== undefined ? title : name;
  
  // Validate color if provided
  if (color && !COURSE_COLORS.includes(color)) {
    color = undefined; // Don't update if invalid
  }
  
  const course = await CourseModel.update(courseId, {
    name: courseName,
    description,
    syllabus,
    language,
    color,
  });
  
  logger.info(`Course updated: ${courseId}`);
  
  return course;
}

/**
 * Delete a course
 * @param {string} courseId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteCourse(courseId, userId) {
  // Verify ownership
  await getCourse(courseId, userId);
  
  // Note: CASCADE will delete chapters, materials, etc.
  await CourseModel.remove(courseId);
  
  logger.info(`Course deleted: ${courseId}`);
}

/**
 * Get available course colors
 * @returns {Array<string>}
 */
function getCourseColors() {
  return COURSE_COLORS;
}

module.exports = {
  createCourse,
  getCourse,
  getCourseWithChapters,
  listCourses,
  updateCourse,
  deleteCourse,
  getCourseColors,
};
