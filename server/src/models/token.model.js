/**
 * Token Model
 * Handles database operations for refresh_tokens table
 */

const db = require('../config/database');
const { generateId, formatDateForMySQL } = require('../utils/helpers');

/**
 * Create a refresh token
 * @param {string} userId
 * @param {string} tokenHash
 * @param {Date} expiresAt
 * @returns {Promise<void>}
 */
async function createRefreshToken(userId, tokenHash, expiresAt) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [id, userId, tokenHash, formatDateForMySQL(expiresAt)]
  );
}

/**
 * Find refresh token with user data
 * @param {string} tokenHash
 * @returns {Promise<Object|null>}
 */
async function findRefreshTokenWithUser(tokenHash) {
  const [rows] = await db.query(
    `SELECT rt.*, u.email, u.first_name, u.last_name, u.email_verified, 
            u.language_preference, u.timezone, u.avatar_url
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = ? AND rt.expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

/**
 * Delete refresh token by hash
 * @param {string} tokenHash
 * @returns {Promise<void>}
 */
async function deleteByTokenHash(tokenHash) {
  await db.query(
    `DELETE FROM refresh_tokens WHERE token_hash = ?`,
    [tokenHash]
  );
}

/**
 * Delete all refresh tokens for a user
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteAllForUser(userId) {
  await db.query(
    `DELETE FROM refresh_tokens WHERE user_id = ?`,
    [userId]
  );
}

/**
 * Clean up expired tokens (maintenance)
 * @returns {Promise<number>} Number of deleted tokens
 */
async function cleanupExpired() {
  const [result] = await db.query(
    `DELETE FROM refresh_tokens WHERE expires_at < NOW()`
  );
  return result.affectedRows;
}

module.exports = {
  createRefreshToken,
  findRefreshTokenWithUser,
  deleteByTokenHash,
  deleteAllForUser,
  cleanupExpired,
};
