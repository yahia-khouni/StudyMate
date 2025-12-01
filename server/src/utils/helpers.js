const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a UUID v4
 */
function generateId() {
  return uuidv4();
}

/**
 * Generate a secure random token
 * @param {number} length - Token length in bytes (default: 32)
 * @returns {string} Hex encoded token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage (prevents token theft if DB is compromised)
 * @param {string} token - Plain token
 * @returns {string} Hashed token
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Get expiry date from now
 * @param {string} duration - Duration string (e.g., '15m', '7d', '1h')
 * @returns {Date} Expiry date
 */
function getExpiryDate(duration) {
  const now = new Date();
  const match = duration.match(/^(\d+)([mhd])$/);
  
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'm':
      now.setMinutes(now.getMinutes() + value);
      break;
    case 'h':
      now.setHours(now.getHours() + value);
      break;
    case 'd':
      now.setDate(now.getDate() + value);
      break;
  }
  
  return now;
}

/**
 * Format date for MySQL datetime
 * @param {Date} date 
 * @returns {string}
 */
function formatDateForMySQL(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  generateId,
  generateToken,
  hashToken,
  getExpiryDate,
  formatDateForMySQL,
};
