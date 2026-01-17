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
async function update(userId, updates) {
  const {
    currentStreak,
    currentStreakStart,
    longestStreak,
    longestStreakStart,
    longestStreakEnd,
    lastActivityDate
  } = updates;
  
  const fields = [];
  const values = [];
  
  if (currentStreak !== undefined) {
    fields.push('current_streak = ?');
    values.push(currentStreak);
  }
  if (currentStreakStart !== undefined) {
    fields.push('current_streak_start = ?');
    values.push(currentStreakStart);
  }
  if (longestStreak !== undefined) {
    fields.push('longest_streak = ?');
    values.push(longestStreak);
  }
  if (longestStreakStart !== undefined) {
    fields.push('longest_streak_start = ?');
    values.push(longestStreakStart);
  }
  if (longestStreakEnd !== undefined) {
    fields.push('longest_streak_end = ?');
    values.push(longestStreakEnd);
  }
  if (lastActivityDate !== undefined) {
    fields.push('last_activity_date = ?');
    values.push(lastActivityDate);
  }
  
  if (fields.length === 0) return;
  
  values.push(userId);
  await db.query(
    `UPDATE streaks SET ${fields.join(', ')} WHERE user_id = ?`,
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
    `UPDATE streaks SET current_streak = 0, current_streak_start = NULL WHERE user_id = ?`,
    [userId]
  );
}

module.exports = {
  initialize,
  findByUserId,
  update,
  reset,
};
