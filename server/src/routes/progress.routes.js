/**
 * Progress Routes
 * Routes for progress tracking and analytics
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const progressController = require('../controllers/progress.controller');

// All routes require authentication
router.use(authenticate);

// Dashboard data (aggregated)
router.get('/dashboard', progressController.getDashboard);

// User-wide progress
router.get('/user', progressController.getUserProgress);

// Weekly activity summary (last 7 days)
router.get('/weekly', progressController.getWeeklyActivity);

// Course progress
router.get('/courses/:courseId', progressController.getCourseProgress);

// Chapter progress
router.get('/chapters/:chapterId', progressController.getChapterProgress);

module.exports = router;
