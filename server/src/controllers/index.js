/**
 * Controllers Index
 * Export all controllers for easy importing
 */

const authController = require('./auth.controller');
const courseController = require('./course.controller');
const chapterController = require('./chapter.controller');
const materialController = require('./material.controller');

module.exports = {
  authController,
  courseController,
  chapterController,
  materialController,
};
