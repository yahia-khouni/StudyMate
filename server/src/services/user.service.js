/**
 * User Service
 * Business logic for user profile and settings
 */

const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const UserModel = require('../models/user.model');

const SALT_ROUNDS = 12;

/**
 * Get user profile by ID
 * @param {string} userId
 * @returns {Promise<Object>} User profile
 */
async function getProfile(userId) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    avatarUrl: user.avatar_url,
    emailVerified: user.email_verified,
    languagePreference: user.language_preference,
    timezone: user.timezone,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

/**
 * Update user profile
 * @param {string} userId
 * @param {Object} updates - { firstName, lastName, avatarUrl, timezone }
 * @returns {Promise<Object>} Updated user profile
 */
async function updateProfile(userId, updates) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  const allowedUpdates = {};
  
  if (updates.firstName !== undefined) {
    allowedUpdates.first_name = updates.firstName.trim();
  }
  if (updates.lastName !== undefined) {
    allowedUpdates.last_name = updates.lastName.trim();
  }
  if (updates.avatarUrl !== undefined) {
    // Validate avatar URL or base64
    if (updates.avatarUrl && updates.avatarUrl.length > 200000) {
      throw new Error('Avatar image too large (max 200KB)');
    }
    allowedUpdates.avatar_url = updates.avatarUrl;
  }
  if (updates.timezone !== undefined) {
    allowedUpdates.timezone = updates.timezone;
  }
  
  if (Object.keys(allowedUpdates).length === 0) {
    return getProfile(userId);
  }
  
  await UserModel.update(userId, allowedUpdates);
  logger.info(`User profile updated: ${userId}`);
  
  return getProfile(userId);
}

/**
 * Update user settings (language preference, etc.)
 * @param {string} userId
 * @param {Object} settings - { languagePreference, notificationsEnabled }
 * @returns {Promise<Object>} Updated settings
 */
async function updateSettings(userId, settings) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  const allowedUpdates = {};
  
  if (settings.languagePreference !== undefined) {
    if (!['en', 'fr'].includes(settings.languagePreference)) {
      throw new Error('Invalid language preference');
    }
    allowedUpdates.language_preference = settings.languagePreference;
  }
  
  if (Object.keys(allowedUpdates).length === 0) {
    return {
      languagePreference: user.language_preference,
    };
  }
  
  await UserModel.update(userId, allowedUpdates);
  logger.info(`User settings updated: ${userId}`);
  
  const updated = await UserModel.findById(userId);
  return {
    languagePreference: updated.language_preference,
  };
}

/**
 * Change user password (authenticated)
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }
  
  // Validate new password
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters');
  }
  
  // Hash and save new password
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserModel.update(userId, { password_hash: newPasswordHash });
  
  logger.info(`Password changed for user: ${userId}`);
}

/**
 * Delete user account
 * @param {string} userId
 * @param {string} password - For confirmation
 * @returns {Promise<void>}
 */
async function deleteAccount(userId, password) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Verify password for confirmation
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Password is incorrect');
  }
  
  // Delete user and all associated data (cascading)
  await UserModel.delete(userId);
  
  logger.info(`User account deleted: ${userId}`);
}

module.exports = {
  getProfile,
  updateProfile,
  updateSettings,
  changePassword,
  deleteAccount,
};
