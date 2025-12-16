/**
 * Models Index
 * Export all models for easy importing
 */

const UserModel = require('./user.model');
const TokenModel = require('./token.model');
const StreakModel = require('./streak.model');
const CourseModel = require('./course.model');
const ChapterModel = require('./chapter.model');
const MaterialModel = require('./material.model');
const JobModel = require('./job.model');

module.exports = {
  UserModel,
  TokenModel,
  StreakModel,
  CourseModel,
  ChapterModel,
  MaterialModel,
  JobModel,
};
