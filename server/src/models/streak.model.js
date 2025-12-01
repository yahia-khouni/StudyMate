/**
 * Streak Model
 * Handles database operations for streaks table
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

/**
 * Initialize streak for a new user
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function initialize(userId) {
  const id = generateId();
  await db.query(
    `INSERT INTO streaks (id, user_id) VALUES (?, ?)`,
    [id, userId]
  );
}

/**
 * Find streak by user ID
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function findByUserId(userId) {
  const [rows] = await db.query(
    `SELECT * FROM streaks WHERE user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Update streak values
 * @param {string} userId
 * @param {Object} updates
 * @returns {Promise<void>}
 */
async function update(userId, { currentStreak, longestStreak, lastActivityDate }) {
  const updates = [];
  const values = [];
  
  if (currentStreak !== undefined) {
    updates.push('current_streak = ?');
    values.push(currentStreak);
  }
  if (longestStreak !== undefined) {
    updates.push('longest_streak = ?');
    values.push(longestStreak);
  }
  if (lastActivityDate !== undefined) {
    updates.push('last_activity_date = ?');
    values.push(lastActivityDate);
  }
  
  if (updates.length === 0) return;
  
  values.push(userId);
  await db.query(
    `UPDATE streaks SET ${updates.join(', ')} WHERE user_id = ?`,
    values
  );
}

/**
 * Reset streak
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function reset(userId) {
  await db.query(
    `UPDATE streaks SET current_streak = 0 WHERE user_id = ?`,
    [userId]
  );
}

module.exports = {
  initialize,
  findByUserId,
  update,
  reset,
};
