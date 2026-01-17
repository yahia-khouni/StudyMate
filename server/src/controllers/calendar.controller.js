/**
 * Calendar Controller
 * Handles HTTP requests for calendar events and study plans
 */

const calendarService = require('../services/calendar.service');
const logger = require('../config/logger');

/**
 * Get all events for the authenticated user
 * GET /api/calendar
 */
async function getEvents(req, res) {
  try {
    const { startDate, endDate, eventType, courseId } = req.query;
    
    const events = await calendarService.getEvents(req.user.id, {
      startDate,
      endDate,
      eventType,
      courseId,
    });
    
    res.json({ events });
  } catch (error) {
    logger.error('Get events error:', error);
    res.status(500).json({ message: 'Failed to get events' });
  }
}

/**
 * Get events by date range
 * GET /api/calendar/range
 */
async function getEventsByRange(req, res) {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }
    
    const events = await calendarService.getEventsByDateRange(
      req.user.id,
      new Date(start),
      new Date(end)
    );
    
    res.json({ events });
  } catch (error) {
    logger.error('Get events by range error:', error);
    res.status(500).json({ message: 'Failed to get events' });
  }
}

/**
 * Get upcoming events (next 7 days)
 * GET /api/calendar/upcoming
 */
async function getUpcomingEvents(req, res) {
  try {
    const events = await calendarService.getUpcomingEvents(req.user.id);
    res.json({ events });
  } catch (error) {
    logger.error('Get upcoming events error:', error);
    res.status(500).json({ message: 'Failed to get upcoming events' });
  }
}

/**
 * Get today's events
 * GET /api/calendar/today
 */
async function getTodayEvents(req, res) {
  try {
    const events = await calendarService.getTodayEvents(req.user.id);
    res.json({ events });
  } catch (error) {
    logger.error('Get today events error:', error);
    res.status(500).json({ message: 'Failed to get today events' });
  }
}

/**
 * Get a single event
 * GET /api/calendar/:id
 */
async function getEvent(req, res) {
  try {
    const event = await calendarService.getEvent(req.params.id, req.user.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({ event });
  } catch (error) {
    logger.error('Get event error:', error);
    res.status(500).json({ message: 'Failed to get event' });
  }
}

/**
 * Create a new event
 * POST /api/calendar
 */
async function createEvent(req, res) {
  try {
    const {
      title,
      description,
      eventType,
      startDate,
      endDate,
      allDay,
      recurrenceRule,
      reminderMinutes,
      courseId,
    } = req.body;
    
    if (!title || !startDate) {
      return res.status(400).json({ message: 'Title and start date are required' });
    }
    
    const event = await calendarService.createEvent(req.user.id, {
      title,
      description,
      eventType,
      startDate,
      endDate,
      allDay,
      recurrenceRule,
      reminderMinutes,
      courseId,
    });
    
    res.status(201).json({ event });
  } catch (error) {
    logger.error('Create event error:', error);
    res.status(500).json({ message: 'Failed to create event' });
  }
}

/**
 * Update an event
 * PUT /api/calendar/:id
 */
async function updateEvent(req, res) {
  try {
    const event = await calendarService.updateEvent(
      req.params.id,
      req.user.id,
      req.body
    );
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({ event });
  } catch (error) {
    logger.error('Update event error:', error);
    res.status(500).json({ message: 'Failed to update event' });
  }
}

/**
 * Delete an event
 * DELETE /api/calendar/:id
 */
async function deleteEvent(req, res) {
  try {
    const deleted = await calendarService.deleteEvent(req.params.id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    logger.error('Delete event error:', error);
    res.status(500).json({ message: 'Failed to delete event' });
  }
}

/**
 * Generate a study plan for a course
 * POST /api/calendar/study-plan
 */
async function generateStudyPlan(req, res) {
  try {
    const {
      courseId,
      examDate,
      sessionsPerDay,
      sessionDuration,
      studyDays,
      preferredTime,
    } = req.body;
    
    if (!courseId || !examDate) {
      return res.status(400).json({ message: 'Course ID and exam date are required' });
    }
    
    const result = await calendarService.generateStudyPlan(req.user.id, courseId, {
      examDate,
      sessionsPerDay,
      sessionDuration,
      studyDays,
      preferredTime,
    });
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('Generate study plan error:', error);
    res.status(400).json({ message: error.message || 'Failed to generate study plan' });
  }
}

/**
 * Get calendar statistics
 * GET /api/calendar/stats
 */
async function getStats(req, res) {
  try {
    const stats = await calendarService.getEventStats(req.user.id);
    res.json(stats);
  } catch (error) {
    logger.error('Get calendar stats error:', error);
    res.status(500).json({ message: 'Failed to get statistics' });
  }
}

module.exports = {
  getEvents,
  getEventsByRange,
  getUpcomingEvents,
  getTodayEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  generateStudyPlan,
  getStats,
};
