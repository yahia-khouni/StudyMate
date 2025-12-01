/**
 * Models Index
 * Export all models for easy importing
 */

const UserModel = require('./user.model');
const TokenModel = require('./token.model');
const StreakModel = require('./streak.model');

module.exports = {
  UserModel,
  TokenModel,
  StreakModel,
};
