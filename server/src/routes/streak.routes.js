/**
 * Streak Routes
 * API endpoints for streak and activity tracking
 */

const express = require('express');
const router = express.Router();
const streakController = require('../controllers/streak.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get current streak
router.get('/', streakController.getStreak);

// Get activity history
router.get('/history', streakController.getHistory);

// Check if user has activity today
router.get('/today', streakController.checkToday);

// Get leaderboard
router.get('/leaderboard', streakController.getLeaderboard);

// Manually check/update streak
router.post('/check', streakController.checkStreak);

module.exports = router;
