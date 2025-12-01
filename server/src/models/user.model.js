/**
 * User Model
 * Handles all database operations for the users table
 */

const db = require('../config/database');
const { generateId, formatDateForMySQL } = require('../utils/helpers');

/**
 * Create a new user
 * @param {Object} userData
 * @returns {Promise<Object>} Created user
 */
async function create({ email, passwordHash, firstName, lastName, languagePreference = 'en', verificationTokenHash, verificationExpires }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, language_preference, 
      email_verification_token, email_verification_expires) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, email.toLowerCase(), passwordHash, firstName, lastName, languagePreference, 
     verificationTokenHash, formatDateForMySQL(verificationExpires)]
  );
  
  return { id, email: email.toLowerCase(), firstName, lastName, languagePreference };
}

/**
 * Find user by email
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findByEmail(email) {
  const [rows] = await db.query(
    `SELECT * FROM users WHERE email = ?`,
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Find user by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await db.query(
    `SELECT id, email, first_name, last_name, avatar_url, google_id, 
            email_verified, language_preference, timezone, created_at, last_login_at, password_hash
     FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Find user by email or Google ID
 * @param {string} email
 * @param {string} googleId
 * @returns {Promise<Object|null>}
 */
async function findByEmailOrGoogleId(email, googleId) {
  const [rows] = await db.query(
    `SELECT * FROM users WHERE email = ? OR google_id = ?`,
    [email.toLowerCase(), googleId]
  );
  return rows[0] || null;
}

/**
 * Find user by verification token
 * @param {string} tokenHash
 * @returns {Promise<Object|null>}
 */
async function findByVerificationToken(tokenHash) {
  const [rows] = await db.query(
    `SELECT id, email, first_name FROM users 
     WHERE email_verification_token = ? 
     AND email_verification_expires > NOW()
     AND email_verified = FALSE`,
    [tokenHash]
  );
  return rows[0] || null;
}

/**
 * Find user by password reset token
 * @param {string} tokenHash
 * @returns {Promise<Object|null>}
 */
async function findByPasswordResetToken(tokenHash) {
  const [rows] = await db.query(
    `SELECT id, email FROM users 
     WHERE password_reset_token = ? 
     AND password_reset_expires > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

/**
 * Update user email verification status
 * @param {string} id
 * @returns {Promise<void>}
 */
async function setEmailVerified(id) {
  await db.query(
    `UPDATE users SET 
      email_verified = TRUE, 
      email_verification_token = NULL, 
      email_verification_expires = NULL
     WHERE id = ?`,
    [id]
  );
}

/**
 * Update verification token
 * @param {string} id
 * @param {string} tokenHash
 * @param {Date} expires
 * @returns {Promise<void>}
 */
async function updateVerificationToken(id, tokenHash, expires) {
  await db.query(
    `UPDATE users SET 
      email_verification_token = ?, 
      email_verification_expires = ?
     WHERE id = ?`,
    [tokenHash, formatDateForMySQL(expires), id]
  );
}

/**
 * Update password reset token
 * @param {string} id
 * @param {string} tokenHash
 * @param {Date} expires
 * @returns {Promise<void>}
 */
async function updatePasswordResetToken(id, tokenHash, expires) {
  await db.query(
    `UPDATE users SET 
      password_reset_token = ?,
      password_reset_expires = ?
     WHERE id = ?`,
    [tokenHash, formatDateForMySQL(expires), id]
  );
}

/**
 * Update user password
 * @param {string} id
 * @param {string} passwordHash
 * @returns {Promise<void>}
 */
async function updatePassword(id, passwordHash) {
  await db.query(
    `UPDATE users SET 
      password_hash = ?,
      password_reset_token = NULL,
      password_reset_expires = NULL
     WHERE id = ?`,
    [passwordHash, id]
  );
}

/**
 * Update last login timestamp
 * @param {string} id
 * @returns {Promise<void>}
 */
async function updateLastLogin(id) {
  await db.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = ?`,
    [id]
  );
}

/**
 * Link Google account to existing user
 * @param {string} id
 * @param {string} googleId
 * @param {string} avatarUrl
 * @returns {Promise<void>}
 */
async function linkGoogleAccount(id, googleId, avatarUrl) {
  await db.query(
    `UPDATE users SET 
      google_id = COALESCE(google_id, ?),
      avatar_url = COALESCE(avatar_url, ?),
      email_verified = TRUE,
      last_login_at = NOW()
     WHERE id = ?`,
    [googleId, avatarUrl, id]
  );
}

/**
 * Create user from Google OAuth
 * @param {Object} userData
 * @returns {Promise<Object>}
 */
async function createFromGoogle({ email, firstName, lastName, googleId, avatarUrl }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO users (id, email, first_name, last_name, google_id, avatar_url, email_verified, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())`,
    [id, email.toLowerCase(), firstName, lastName, googleId, avatarUrl]
  );
  
  return { 
    id, 
    email: email.toLowerCase(), 
    first_name: firstName, 
    last_name: lastName, 
    avatar_url: avatarUrl, 
    email_verified: true,
    language_preference: 'en',
    timezone: 'UTC'
  };
}

/**
 * Format user object for API response
 * @param {Object} user - Raw user from database
 * @returns {Object} Formatted user
 */
function formatUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    avatarUrl: user.avatar_url,
    emailVerified: user.email_verified,
    languagePreference: user.language_preference || 'en',
    timezone: user.timezone || 'UTC',
  };
}

module.exports = {
  create,
  findByEmail,
  findById,
  findByEmailOrGoogleId,
  findByVerificationToken,
  findByPasswordResetToken,
  setEmailVerified,
  updateVerificationToken,
  updatePasswordResetToken,
  updatePassword,
  updateLastLogin,
  linkGoogleAccount,
  createFromGoogle,
  formatUser,
};
