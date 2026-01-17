/**
 * Calendar Routes
 * API endpoints for calendar events and study plans
 */

const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Calendar stats
router.get('/stats', calendarController.getStats);

// Get events by date range
router.get('/range', calendarController.getEventsByRange);

// Get upcoming events (next 7 days)
router.get('/upcoming', calendarController.getUpcomingEvents);

// Get today's events
router.get('/today', calendarController.getTodayEvents);

// Generate study plan
router.post('/study-plan', calendarController.generateStudyPlan);

// CRUD operations
router.get('/', calendarController.getEvents);
router.get('/:id', calendarController.getEvent);
router.post('/', calendarController.createEvent);
router.put('/:id', calendarController.updateEvent);
router.delete('/:id', calendarController.deleteEvent);

module.exports = router;
