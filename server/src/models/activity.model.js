/**
 * Activity Model
 * Database operations for activity_log table - tracks user study activities
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Activity types
 */
const ACTIVITY_TYPES = {
  UPLOAD: 'upload',
  FLASHCARD_REVIEW: 'flashcard_review',
  QUIZ: 'quiz',
  CHAT: 'chat',
};

/**
 * Entity types
 */
const ENTITY_TYPES = {
  CHAPTER: 'chapter',
  FLASHCARD: 'flashcard',
  QUIZ: 'quiz',
  CHAT_SESSION: 'chat_session',
};

/**
 * Log a user activity
 * @param {Object} activityData - Activity details
 * @returns {Promise<Object>} Created activity
 */
async function logActivity(activityData) {
  const id = uuidv4();
  const {
    userId,
    activityType,
    entityType,
    entityId,
    activityDate = new Date().toISOString().split('T')[0], // Default to today
  } = activityData;

  // Check if activity already logged for this entity today (prevent duplicates)
  const existing = await findTodayActivity(userId, activityType, entityId, activityDate);
  if (existing) {
    return existing;
  }

  await db.query(
    `INSERT INTO activity_log (id, user_id, activity_type, entity_type, entity_id, activity_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, activityType, entityType, entityId, activityDate]
  );

  return { id, userId, activityType, entityType, entityId, activityDate };
}

/**
 * Find activity for today (to prevent duplicates)
 * @param {string} userId - User ID
 * @param {string} activityType - Activity type
 * @param {string} entityId - Entity ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<Object|null>} Activity or null
 */
async function findTodayActivity(userId, activityType, entityId, date) {
  const [rows] = await db.query(
    `SELECT * FROM activity_log 
     WHERE user_id = ? AND activity_type = ? AND entity_id = ? AND activity_date = ?`,
    [userId, activityType, entityId, date]
  );
  return rows[0] || null;
}

/**
 * Check if user has any activity on a specific date
 * @param {string} userId - User ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<boolean>} Has activity
 */
async function hasActivityOnDate(userId, date) {
  const [rows] = await db.query(
    `SELECT COUNT(*) as count FROM activity_log WHERE user_id = ? AND activity_date = ?`,
    [userId, date]
  );
  return rows[0].count > 0;
}

/**
 * Get activity count by date range
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Activities by date
 */
async function getActivityByDateRange(userId, startDate, endDate) {
  const [rows] = await db.query(
    `SELECT activity_date, activity_type, COUNT(*) as count
     FROM activity_log
     WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
     GROUP BY activity_date, activity_type
     ORDER BY activity_date DESC`,
    [userId, startDate, endDate]
  );
  return rows;
}

/**
 * Get daily activity summary (count per day)
 * @param {string} userId - User ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Daily counts
 */
async function getDailyActivitySummary(userId, days = 30) {
  const [rows] = await db.query(
    `SELECT activity_date, COUNT(*) as activity_count
     FROM activity_log
     WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY activity_date
     ORDER BY activity_date DESC`,
    [userId, days]
  );
  return rows;
}

/**
 * Get dates with activity (for streak calculation)
 * @param {string} userId - User ID
 * @param {number} days - Days to look back
 * @returns {Promise<Array<string>>} Array of dates (YYYY-MM-DD)
 */
async function getActivityDates(userId, days = 365) {
  const [rows] = await db.query(
    `SELECT DISTINCT activity_date
     FROM activity_log
     WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY activity_date DESC`,
    [userId, days]
  );
  return rows.map(row => row.activity_date.toISOString().split('T')[0]);
}

/**
 * Get last activity date for a user
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Last activity date or null
 */
async function getLastActivityDate(userId) {
  const [rows] = await db.query(
    `SELECT MAX(activity_date) as last_date FROM activity_log WHERE user_id = ?`,
    [userId]
  );
  if (rows[0].last_date) {
    return rows[0].last_date.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Get activity stats by type
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Stats by activity type
 */
async function getStatsByType(userId) {
  const [rows] = await db.query(
    `SELECT activity_type, COUNT(*) as count
     FROM activity_log
     WHERE user_id = ?
     GROUP BY activity_type`,
    [userId]
  );
  
  return rows.reduce((acc, row) => {
    acc[row.activity_type] = row.count;
    return acc;
  }, {
    upload: 0,
    flashcard_review: 0,
    quiz: 0,
    chat: 0,
  });
}

/**
 * Get weekly activity summary
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Weekly data (last 12 weeks)
 */
async function getWeeklySummary(userId) {
  const [rows] = await db.query(
    `SELECT 
       YEARWEEK(activity_date, 1) as week,
       MIN(activity_date) as week_start,
       COUNT(*) as activity_count,
       COUNT(DISTINCT activity_date) as active_days
     FROM activity_log
     WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
     GROUP BY YEARWEEK(activity_date, 1)
     ORDER BY week DESC`,
    [userId]
  );
  return rows;
}

/**
 * Delete all activities for a user (for account deletion)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number deleted
 */
async function deleteByUser(userId) {
  const [result] = await db.query(
    `DELETE FROM activity_log WHERE user_id = ?`,
    [userId]
  );
  return result.affectedRows;
}

module.exports = {
  ACTIVITY_TYPES,
  ENTITY_TYPES,
  logActivity,
  findTodayActivity,
  hasActivityOnDate,
  getActivityByDateRange,
  getDailyActivitySummary,
  getActivityDates,
  getLastActivityDate,
  getStatsByType,
  getWeeklySummary,
  deleteByUser,
};
