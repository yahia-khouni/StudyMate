const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const logger = require('../config/logger');
const { generateId, generateToken, hashToken, getExpiryDate, formatDateForMySQL } = require('../utils/helpers');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./email.service');

const SALT_ROUNDS = 12;

/**
 * Create a new user with email/password
 */
async function createUser({ email, password, firstName, lastName, languagePreference = 'en' }) {
  const id = generateId();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  // Generate email verification token
  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpires = getExpiryDate('24h');
  
  try {
    await db.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, language_preference, 
        email_verification_token, email_verification_expires) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email.toLowerCase(), passwordHash, firstName, lastName, languagePreference, 
       verificationTokenHash, formatDateForMySQL(verificationExpires)]
    );
    
    // Send verification email
    await sendVerificationEmail(email, firstName, verificationToken);
    
    logger.info(`User created: ${email}`);
    
    return { id, email: email.toLowerCase(), firstName, lastName, languagePreference };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Email already registered');
    }
    throw error;
  }
}

/**
 * Find user by email
 */
async function findUserByEmail(email) {
  const [rows] = await db.query(
    `SELECT * FROM users WHERE email = ?`,
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Find user by ID
 */
async function findUserById(id) {
  const [rows] = await db.query(
    `SELECT id, email, first_name, last_name, avatar_url, google_id, 
            email_verified, language_preference, timezone, created_at, last_login_at
     FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Verify email with token
 */
async function verifyEmail(token) {
  const tokenHash = hashToken(token);
  
  const [rows] = await db.query(
    `SELECT id, email, first_name FROM users 
     WHERE email_verification_token = ? 
     AND email_verification_expires > NOW()
     AND email_verified = FALSE`,
    [tokenHash]
  );
  
  if (!rows[0]) {
    throw new Error('Invalid or expired verification token');
  }
  
  await db.query(
    `UPDATE users SET 
      email_verified = TRUE, 
      email_verification_token = NULL, 
      email_verification_expires = NULL
     WHERE id = ?`,
    [rows[0].id]
  );
  
  logger.info(`Email verified: ${rows[0].email}`);
  
  return rows[0];
}

/**
 * Resend verification email
 */
async function resendVerificationEmail(email) {
  const user = await findUserByEmail(email);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  if (user.email_verified) {
    throw new Error('Email already verified');
  }
  
  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpires = getExpiryDate('24h');
  
  await db.query(
    `UPDATE users SET 
      email_verification_token = ?, 
      email_verification_expires = ?
     WHERE id = ?`,
    [verificationTokenHash, formatDateForMySQL(verificationExpires), user.id]
  );
  
  await sendVerificationEmail(email, user.first_name, verificationToken);
  
  logger.info(`Verification email resent: ${email}`);
}

/**
 * Login with email/password
 */
async function loginWithPassword(email, password) {
  const user = await findUserByEmail(email);
  
  if (!user || !user.password_hash) {
    throw new Error('Invalid email or password');
  }
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isValid) {
    throw new Error('Invalid email or password');
  }
  
  // Update last login
  await db.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = ?`,
    [user.id]
  );
  
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    avatarUrl: user.avatar_url,
    emailVerified: user.email_verified,
    languagePreference: user.language_preference,
    timezone: user.timezone,
  };
}

/**
 * Create or update user from Google OAuth
 */
async function findOrCreateGoogleUser(profile) {
  const email = profile.emails[0].value.toLowerCase();
  const googleId = profile.id;
  const firstName = profile.name.givenName || profile.displayName.split(' ')[0];
  const lastName = profile.name.familyName || profile.displayName.split(' ').slice(1).join(' ');
  const avatarUrl = profile.photos?.[0]?.value || null;
  
  // Check if user exists by email or google_id
  let [rows] = await db.query(
    `SELECT * FROM users WHERE email = ? OR google_id = ?`,
    [email, googleId]
  );
  
  let user = rows[0];
  
  if (user) {
    // Update existing user - link Google account if not already linked
    await db.query(
      `UPDATE users SET 
        google_id = COALESCE(google_id, ?),
        avatar_url = COALESCE(avatar_url, ?),
        email_verified = TRUE,
        last_login_at = NOW()
       WHERE id = ?`,
      [googleId, avatarUrl, user.id]
    );
    
    user.email_verified = true;
    logger.info(`Google user logged in: ${email}`);
  } else {
    // Create new user
    const id = generateId();
    
    await db.query(
      `INSERT INTO users (id, email, first_name, last_name, google_id, avatar_url, email_verified, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [id, email, firstName, lastName, googleId, avatarUrl]
    );
    
    user = { id, email, first_name: firstName, last_name: lastName, avatar_url: avatarUrl, email_verified: true };
    logger.info(`Google user created: ${email}`);
  }
  
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    avatarUrl: user.avatar_url,
    emailVerified: true,
    languagePreference: user.language_preference || 'en',
    timezone: user.timezone || 'UTC',
  };
}

/**
 * Generate access token (short-lived)
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
 * Generate refresh token and store in database
 */
async function generateRefreshToken(userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const id = generateId();
  const expiresAt = getExpiryDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
  
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [id, userId, tokenHash, formatDateForMySQL(expiresAt)]
  );
  
  return { token, expiresAt };
}

/**
 * Verify and refresh tokens
 */
async function refreshAccessToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  
  const [rows] = await db.query(
    `SELECT rt.*, u.email, u.first_name, u.last_name, u.email_verified, 
            u.language_preference, u.timezone, u.avatar_url
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = ? AND rt.expires_at > NOW()`,
    [tokenHash]
  );
  
  if (!rows[0]) {
    throw new Error('Invalid or expired refresh token');
  }
  
  const user = {
    id: rows[0].user_id,
    email: rows[0].email,
    firstName: rows[0].first_name,
    lastName: rows[0].last_name,
    emailVerified: rows[0].email_verified,
    languagePreference: rows[0].language_preference,
    timezone: rows[0].timezone,
    avatarUrl: rows[0].avatar_url,
  };
  
  const accessToken = generateAccessToken(user);
  
  return { accessToken, user };
}

/**
 * Revoke refresh token (logout)
 */
async function revokeRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  
  await db.query(
    `DELETE FROM refresh_tokens WHERE token_hash = ?`,
    [tokenHash]
  );
}

/**
 * Revoke all refresh tokens for a user
 */
async function revokeAllRefreshTokens(userId) {
  await db.query(
    `DELETE FROM refresh_tokens WHERE user_id = ?`,
    [userId]
  );
}

/**
 * Request password reset
 */
async function requestPasswordReset(email) {
  const user = await findUserByEmail(email);
  
  if (!user) {
    // Don't reveal if email exists
    return;
  }
  
  const resetToken = generateToken();
  const resetTokenHash = hashToken(resetToken);
  const resetExpires = getExpiryDate('1h');
  
  await db.query(
    `UPDATE users SET 
      password_reset_token = ?,
      password_reset_expires = ?
     WHERE id = ?`,
    [resetTokenHash, formatDateForMySQL(resetExpires), user.id]
  );
  
  await sendPasswordResetEmail(email, user.first_name, resetToken);
  
  logger.info(`Password reset requested: ${email}`);
}

/**
 * Reset password with token
 */
async function resetPassword(token, newPassword) {
  const tokenHash = hashToken(token);
  
  const [rows] = await db.query(
    `SELECT id, email FROM users 
     WHERE password_reset_token = ? 
     AND password_reset_expires > NOW()`,
    [tokenHash]
  );
  
  if (!rows[0]) {
    throw new Error('Invalid or expired reset token');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await db.query(
    `UPDATE users SET 
      password_hash = ?,
      password_reset_token = NULL,
      password_reset_expires = NULL
     WHERE id = ?`,
    [passwordHash, rows[0].id]
  );
  
  // Revoke all refresh tokens for security
  await revokeAllRefreshTokens(rows[0].id);
  
  logger.info(`Password reset completed: ${rows[0].email}`);
  
  return rows[0];
}

/**
 * Change password (when logged in)
 */
async function changePassword(userId, currentPassword, newPassword) {
  const [rows] = await db.query(
    `SELECT password_hash FROM users WHERE id = ?`,
    [userId]
  );
  
  if (!rows[0] || !rows[0].password_hash) {
    throw new Error('Cannot change password for OAuth-only accounts');
  }
  
  const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await db.query(
    `UPDATE users SET password_hash = ? WHERE id = ?`,
    [passwordHash, userId]
  );
  
  // Revoke all other refresh tokens
  await revokeAllRefreshTokens(userId);
  
  logger.info(`Password changed for user: ${userId}`);
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Initialize streak record for new user
 */
async function initializeUserStreak(userId) {
  const id = generateId();
  await db.query(
    `INSERT INTO streaks (id, user_id) VALUES (?, ?)`,
    [id, userId]
  );
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  verifyEmail,
  resendVerificationEmail,
  loginWithPassword,
  findOrCreateGoogleUser,
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  requestPasswordReset,
  resetPassword,
  changePassword,
  verifyAccessToken,
  initializeUserStreak,
};
