/**
 * Streak Controller
 * Handles HTTP requests for streak and activity tracking
 */

const streakService = require('../services/streak.service');
const logger = require('../config/logger');

/**
 * Get current streak info
 * GET /api/streaks
 */
async function getStreak(req, res) {
  try {
    const streak = await streakService.getStreak(req.user.id);
    res.json(streak);
  } catch (error) {
    logger.error('Get streak error:', error);
    res.status(500).json({ message: 'Failed to get streak' });
  }
}

/**
 * Get activity history
 * GET /api/streaks/history
 */
async function getHistory(req, res) {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = await streakService.getActivityHistory(req.user.id, days);
    res.json(history);
  } catch (error) {
    logger.error('Get activity history error:', error);
    res.status(500).json({ message: 'Failed to get activity history' });
  }
}

/**
 * Check if user has activity today
 * GET /api/streaks/today
 */
async function checkToday(req, res) {
  try {
    const hasActivity = await streakService.hasActivityToday(req.user.id);
    res.json({ hasActivity });
  } catch (error) {
    logger.error('Check today activity error:', error);
    res.status(500).json({ message: 'Failed to check today activity' });
  }
}

/**
 * Get streak leaderboard
 * GET /api/streaks/leaderboard
 */
async function getLeaderboard(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await streakService.getStreakLeaderboard(limit);
    res.json({ leaderboard });
  } catch (error) {
    logger.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Failed to get leaderboard' });
  }
}

/**
 * Manually check and update streak (useful for debugging)
 * POST /api/streaks/check
 */
async function checkStreak(req, res) {
  try {
    const streak = await streakService.checkAndResetStreak(req.user.id);
    res.json(streak);
  } catch (error) {
    logger.error('Check streak error:', error);
    res.status(500).json({ message: 'Failed to check streak' });
  }
}

module.exports = {
  getStreak,
  getHistory,
  checkToday,
  getLeaderboard,
  checkStreak,
};
