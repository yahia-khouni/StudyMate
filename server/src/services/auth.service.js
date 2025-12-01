/**
 * Auth Service
 * Business logic for authentication
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const { generateToken, hashToken, getExpiryDate } = require('../utils/helpers');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./email.service');
const UserModel = require('../models/user.model');
const TokenModel = require('../models/token.model');
const StreakModel = require('../models/streak.model');

const SALT_ROUNDS = 12;

/**
 * Register a new user with email/password
 * @param {Object} userData
 * @returns {Promise<Object>} Created user
 */
async function registerUser({ email, password, firstName, lastName, languagePreference = 'en' }) {
  // Check if email already exists
  const existingUser = await UserModel.findByEmail(email);
  if (existingUser) {
    throw new Error('Email already registered');
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  // Generate verification token
  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpires = getExpiryDate('24h');
  
  // Create user
  const user = await UserModel.create({
    email,
    passwordHash,
    firstName,
    lastName,
    languagePreference,
    verificationTokenHash,
    verificationExpires,
  });
  
  // Initialize streak
  await StreakModel.initialize(user.id);
  
  // Send verification email
  await sendVerificationEmail(email, firstName, verificationToken);
  
  logger.info(`User registered: ${email}`);
  
  return user;
}

/**
 * Login with email/password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} User data
 */
async function loginWithPassword(email, password) {
  const user = await UserModel.findByEmail(email);
  
  if (!user || !user.password_hash) {
    throw new Error('Invalid email or password');
  }
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isValid) {
    throw new Error('Invalid email or password');
  }
  
  // Update last login
  await UserModel.updateLastLogin(user.id);
  
  logger.info(`User logged in: ${email}`);
  
  return UserModel.formatUser(user);
}

/**
 * Process Google OAuth login/register
 * @param {Object} profile - Google profile
 * @returns {Promise<Object>} User data
 */
async function processGoogleAuth(profile) {
  const email = profile.emails[0].value.toLowerCase();
  const googleId = profile.id;
  const firstName = profile.name.givenName || profile.displayName.split(' ')[0];
  const lastName = profile.name.familyName || profile.displayName.split(' ').slice(1).join(' ');
  const avatarUrl = profile.photos?.[0]?.value || null;
  
  // Check if user exists
  let user = await UserModel.findByEmailOrGoogleId(email, googleId);
  
  if (user) {
    // Link Google account if not already linked
    await UserModel.linkGoogleAccount(user.id, googleId, avatarUrl);
    user.email_verified = true;
    logger.info(`Google user logged in: ${email}`);
  } else {
    // Create new user
    user = await UserModel.createFromGoogle({
      email,
      firstName,
      lastName,
      googleId,
      avatarUrl,
    });
    
    // Initialize streak
    try {
      await StreakModel.initialize(user.id);
    } catch (e) {
      // Streak might already exist
    }
    
    logger.info(`Google user created: ${email}`);
  }
  
  return UserModel.formatUser(user);
}

/**
 * Verify email with token
 * @param {string} token
 * @returns {Promise<Object>} User data
 */
async function verifyEmail(token) {
  const tokenHash = hashToken(token);
  const user = await UserModel.findByVerificationToken(tokenHash);
  
  if (!user) {
    throw new Error('Invalid or expired verification token');
  }
  
  await UserModel.setEmailVerified(user.id);
  
  logger.info(`Email verified: ${user.email}`);
  
  return user;
}

/**
 * Resend verification email
 * @param {string} email
 */
async function resendVerificationEmail(email) {
  const user = await UserModel.findByEmail(email);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  if (user.email_verified) {
    throw new Error('Email already verified');
  }
  
  // Generate new token
  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpires = getExpiryDate('24h');
  
  await UserModel.updateVerificationToken(user.id, verificationTokenHash, verificationExpires);
  
  await sendVerificationEmail(email, user.first_name, verificationToken);
  
  logger.info(`Verification email resent: ${email}`);
}

/**
 * Request password reset
 * @param {string} email
 */
async function requestPasswordReset(email) {
  const user = await UserModel.findByEmail(email);
  
  if (!user) {
    // Don't reveal if email exists
    return;
  }
  
  const resetToken = generateToken();
  const resetTokenHash = hashToken(resetToken);
  const resetExpires = getExpiryDate('1h');
  
  await UserModel.updatePasswordResetToken(user.id, resetTokenHash, resetExpires);
  
  await sendPasswordResetEmail(email, user.first_name, resetToken);
  
  logger.info(`Password reset requested: ${email}`);
}

/**
 * Reset password with token
 * @param {string} token
 * @param {string} newPassword
 * @returns {Promise<Object>} User data
 */
async function resetPassword(token, newPassword) {
  const tokenHash = hashToken(token);
  const user = await UserModel.findByPasswordResetToken(tokenHash);
  
  if (!user) {
    throw new Error('Invalid or expired reset token');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await UserModel.updatePassword(user.id, passwordHash);
  
  // Revoke all refresh tokens for security
  await TokenModel.deleteAllForUser(user.id);
  
  logger.info(`Password reset completed: ${user.email}`);
  
  return user;
}

/**
 * Change password (authenticated user)
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await UserModel.findById(userId);
  
  if (!user || !user.password_hash) {
    throw new Error('Cannot change password for OAuth-only accounts');
  }
  
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await UserModel.updatePassword(userId, passwordHash);
  
  // Revoke all refresh tokens
  await TokenModel.deleteAllForUser(userId);
  
  logger.info(`Password changed for user: ${userId}`);
}

/**
 * Generate access token (JWT)
 * @param {Object} user
 * @returns {string} Access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

/**
 * Verify access token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Generate and store refresh token
 * @param {string} userId
 * @returns {Promise<Object>} Token and expiry
 */
async function generateRefreshToken(userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = getExpiryDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
  
  await TokenModel.createRefreshToken(userId, tokenHash, expiresAt);
  
  return { token, expiresAt };
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken
 * @returns {Promise<Object>} New access token and user data
 */
async function refreshAccessToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const tokenData = await TokenModel.findRefreshTokenWithUser(tokenHash);
  
  if (!tokenData) {
    throw new Error('Invalid or expired refresh token');
  }
  
  const user = {
    id: tokenData.user_id,
    email: tokenData.email,
    firstName: tokenData.first_name,
    lastName: tokenData.last_name,
    emailVerified: tokenData.email_verified,
    languagePreference: tokenData.language_preference,
    timezone: tokenData.timezone,
    avatarUrl: tokenData.avatar_url,
  };
  
  const accessToken = generateAccessToken(user);
  
  return { accessToken, user };
}

/**
 * Revoke refresh token
 * @param {string} refreshToken
 */
async function revokeRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  await TokenModel.deleteByTokenHash(tokenHash);
}

/**
 * Get user by ID
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getUserById(userId) {
  const user = await UserModel.findById(userId);
  return UserModel.formatUser(user);
}

module.exports = {
  registerUser,
  loginWithPassword,
  processGoogleAuth,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  getUserById,
};
