/**
 * Streak Service
 * Business logic for tracking and managing user study streaks
 */

const StreakModel = require('../models/streak.model');
const ActivityModel = require('../models/activity.model');
const logger = require('../config/logger');

/**
 * Get current streak info for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Streak info
 */
async function getStreak(userId) {
  let streak = await StreakModel.findByUserId(userId);
  
  if (!streak) {
    // Initialize streak if not exists
    await StreakModel.initialize(userId);
    streak = await StreakModel.findByUserId(userId);
  }
  
  return {
    currentStreak: streak.current_streak || 0,
    longestStreak: streak.longest_streak || 0,
    currentStreakStart: streak.current_streak_start,
    longestStreakStart: streak.longest_streak_start,
    longestStreakEnd: streak.longest_streak_end,
    lastActivityDate: streak.last_activity_date,
  };
}

/**
 * Log activity and update streak
 * @param {string} userId - User ID
 * @param {string} activityType - Type of activity
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object>} Updated streak info
 */
async function logActivityAndUpdateStreak(userId, activityType, entityType, entityId) {
  const today = getTodayDateString();
  
  // Log the activity
  await ActivityModel.logActivity({
    userId,
    activityType,
    entityType,
    entityId,
    activityDate: today,
  });
  
  // Update streak
  return updateStreak(userId, today);
}

/**
 * Update streak based on activity
 * @param {string} userId - User ID
 * @param {string} activityDate - Date of activity (YYYY-MM-DD)
 * @returns {Promise<Object>} Updated streak info
 */
async function updateStreak(userId, activityDate) {
  let streak = await StreakModel.findByUserId(userId);
  
  if (!streak) {
    await StreakModel.initialize(userId);
    streak = await StreakModel.findByUserId(userId);
  }
  
  const today = activityDate || getTodayDateString();
  const yesterday = getYesterdayDateString();
  const lastActivity = streak.last_activity_date 
    ? streak.last_activity_date.toISOString().split('T')[0]
    : null;
  
  // If already logged activity today, no change needed
  if (lastActivity === today) {
    return getStreak(userId);
  }
  
  let newCurrentStreak = streak.current_streak || 0;
  let newLongestStreak = streak.longest_streak || 0;
  let newCurrentStreakStart = streak.current_streak_start;
  let newLongestStreakStart = streak.longest_streak_start;
  let newLongestStreakEnd = streak.longest_streak_end;
  
  if (lastActivity === yesterday) {
    // Continuing streak
    newCurrentStreak += 1;
    logger.info(`Streak continued for user ${userId}: ${newCurrentStreak} days`);
  } else if (lastActivity === null || lastActivity < yesterday) {
    // Starting new streak (first activity or break in streak)
    newCurrentStreak = 1;
    newCurrentStreakStart = today;
    logger.info(`New streak started for user ${userId}`);
  }
  
  // Check if new longest streak
  if (newCurrentStreak > newLongestStreak) {
    newLongestStreak = newCurrentStreak;
    newLongestStreakStart = newCurrentStreakStart;
    newLongestStreakEnd = today;
    logger.info(`New longest streak for user ${userId}: ${newLongestStreak} days`);
  }
  
  // Update database
  await StreakModel.update(userId, {
    currentStreak: newCurrentStreak,
    currentStreakStart: newCurrentStreakStart,
    longestStreak: newLongestStreak,
    longestStreakStart: newLongestStreakStart,
    longestStreakEnd: newLongestStreakEnd,
    lastActivityDate: today,
  });
  
  return getStreak(userId);
}

/**
 * Check and reset broken streaks (called daily)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated streak info
 */
async function checkAndResetStreak(userId) {
  const streak = await StreakModel.findByUserId(userId);
  
  if (!streak) {
    return { currentStreak: 0, longestStreak: 0 };
  }
  
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  const lastActivity = streak.last_activity_date
    ? streak.last_activity_date.toISOString().split('T')[0]
    : null;
  
  // If last activity was before yesterday, streak is broken
  if (lastActivity && lastActivity < yesterday) {
    logger.info(`Streak reset for user ${userId}: last activity was ${lastActivity}`);
    await StreakModel.reset(userId);
    return getStreak(userId);
  }
  
  return getStreak(userId);
}

/**
 * Check if user has activity today
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Has activity today
 */
async function hasActivityToday(userId) {
  const today = getTodayDateString();
  return ActivityModel.hasActivityOnDate(userId, today);
}

/**
 * Get activity history for streak visualization
 * @param {string} userId - User ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Activity history
 */
async function getActivityHistory(userId, days = 30) {
  const activityDates = await ActivityModel.getActivityDates(userId, days);
  const dailySummary = await ActivityModel.getDailyActivitySummary(userId, days);
  const stats = await ActivityModel.getStatsByType(userId);
  
  // Create a map of date -> activity count
  const dateMap = {};
  dailySummary.forEach(day => {
    const dateStr = day.activity_date.toISOString().split('T')[0];
    dateMap[dateStr] = day.activity_count;
  });
  
  return {
    activityDates,
    dailyActivity: dateMap,
    totalActivities: stats,
  };
}

/**
 * Get users who need streak reminders
 * (Have active streaks but no activity today)
 * @returns {Promise<Array>} Users needing reminders
 */
async function getUsersNeedingStreakReminder() {
  const db = require('../config/database');
  const today = getTodayDateString();
  
  const [rows] = await db.query(
    `SELECT s.user_id, s.current_streak, u.email, u.first_name, u.language_preference
     FROM streaks s
     JOIN users u ON s.user_id = u.id
     WHERE s.current_streak > 0
       AND s.last_activity_date < ?
       AND NOT EXISTS (
         SELECT 1 FROM activity_log a 
         WHERE a.user_id = s.user_id AND a.activity_date = ?
       )`,
    [today, today]
  );
  
  return rows;
}

/**
 * Get leaderboard of top streaks
 * @param {number} limit - Max users to return
 * @returns {Promise<Array>} Top streakers
 */
async function getStreakLeaderboard(limit = 10) {
  const db = require('../config/database');
  
  const [rows] = await db.query(
    `SELECT s.current_streak, s.longest_streak, u.first_name, u.last_name
     FROM streaks s
     JOIN users u ON s.user_id = u.id
     WHERE s.current_streak > 0
     ORDER BY s.current_streak DESC
     LIMIT ?`,
    [limit]
  );
  
  return rows.map((row, index) => ({
    rank: index + 1,
    name: `${row.first_name} ${row.last_name?.charAt(0) || ''}.`,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
  }));
}

// Helper functions
function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayDateString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

module.exports = {
  getStreak,
  logActivityAndUpdateStreak,
  updateStreak,
  checkAndResetStreak,
  hasActivityToday,
  getActivityHistory,
  getUsersNeedingStreakReminder,
  getStreakLeaderboard,
};
