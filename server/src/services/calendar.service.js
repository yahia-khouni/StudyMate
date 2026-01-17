/**
 * Calendar Service
 * Business logic for calendar events and study plan generation
 */

const CalendarModel = require('../models/calendar.model');
const ChapterModel = require('../models/chapter.model');
const CourseModel = require('../models/course.model');
const logger = require('../config/logger');

/**
 * Create a calendar event
 * @param {string} userId - User ID
 * @param {Object} eventData - Event details
 * @returns {Promise<Object>} Created event
 */
async function createEvent(userId, eventData) {
  const event = await CalendarModel.create({
    userId,
    ...eventData,
  });
  
  logger.info(`Calendar event created: ${event.id} for user ${userId}`);
  return event;
}

/**
 * Get all events for a user with optional filters
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Events list
 */
async function getEvents(userId, filters = {}) {
  return CalendarModel.findByUser(userId, filters);
}

/**
 * Get events for a date range
 * @param {string} userId - User ID
 * @param {Date} startDate - Range start
 * @param {Date} endDate - Range end
 * @returns {Promise<Array>} Events in range
 */
async function getEventsByDateRange(userId, startDate, endDate) {
  return CalendarModel.findByDateRange(userId, startDate, endDate);
}

/**
 * Get a single event
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID (for ownership check)
 * @returns {Promise<Object|null>} Event or null
 */
async function getEvent(eventId, userId) {
  const event = await CalendarModel.findById(eventId);
  if (event && event.user_id !== userId) {
    return null; // Not owned by user
  }
  return event;
}

/**
 * Update an event
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID (for ownership check)
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated event or null
 */
async function updateEvent(eventId, userId, updates) {
  const event = await CalendarModel.findById(eventId);
  if (!event || event.user_id !== userId) {
    return null;
  }
  
  return CalendarModel.update(eventId, updates);
}

/**
 * Delete an event
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID (for ownership check)
 * @returns {Promise<boolean>} Success
 */
async function deleteEvent(eventId, userId) {
  const event = await CalendarModel.findById(eventId);
  if (!event || event.user_id !== userId) {
    return false;
  }
  
  return CalendarModel.deleteById(eventId);
}

/**
 * Generate a study plan for a course
 * Creates calendar events for each chapter based on exam date
 * 
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @param {Object} options - Study plan options
 * @param {Date} options.examDate - Exam/target date
 * @param {number} options.sessionsPerDay - Max sessions per day (default: 2)
 * @param {number} options.sessionDuration - Minutes per session (default: 60)
 * @param {Array<number>} options.studyDays - Days of week to study (0=Sun, 1=Mon, etc.)
 * @param {string} options.preferredTime - Preferred start time (HH:MM)
 * @returns {Promise<Object>} Study plan result
 */
async function generateStudyPlan(userId, courseId, options) {
  const {
    examDate,
    sessionsPerDay = 2,
    sessionDuration = 60,
    studyDays = [1, 2, 3, 4, 5], // Mon-Fri by default
    preferredTime = '09:00',
  } = options;

  // Validate exam date
  const exam = new Date(examDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (exam <= today) {
    throw new Error('Exam date must be in the future');
  }

  // Get course and chapters
  const course = await CourseModel.findById(courseId);
  if (!course || course.user_id !== userId) {
    throw new Error('Course not found');
  }

  const chapters = await ChapterModel.findByCourseId(courseId);
  if (!chapters || chapters.length === 0) {
    throw new Error('No chapters found for this course');
  }

  // Calculate available study days
  const availableDays = getAvailableStudyDays(today, exam, studyDays);
  
  if (availableDays.length === 0) {
    throw new Error('No available study days between now and exam date');
  }

  // Calculate sessions needed
  const totalSessions = chapters.length;
  const totalSlots = availableDays.length * sessionsPerDay;
  
  if (totalSlots < totalSessions) {
    logger.warn(`Study plan: Not enough slots (${totalSlots}) for all chapters (${totalSessions})`);
  }

  // Delete existing study events for this course
  await CalendarModel.deleteStudyEventsByCourse(userId, courseId);

  // Generate study events
  const events = [];
  let slotIndex = 0;
  const [hours, minutes] = preferredTime.split(':').map(Number);

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const dayIndex = Math.floor(slotIndex / sessionsPerDay);
    const sessionOfDay = slotIndex % sessionsPerDay;
    
    if (dayIndex >= availableDays.length) {
      // Not enough days, schedule remaining on last day
      logger.warn(`Study plan: Overflow - scheduling chapter ${chapter.title} on last available day`);
    }

    const studyDate = availableDays[Math.min(dayIndex, availableDays.length - 1)];
    const startTime = new Date(studyDate);
    startTime.setHours(hours + sessionOfDay * Math.ceil(sessionDuration / 60), minutes, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + sessionDuration);

    events.push({
      userId,
      courseId,
      title: `Study: ${chapter.title}`,
      description: `Study session for Chapter ${chapter.order_index + 1}: ${chapter.title}\nCourse: ${course.title}`,
      eventType: 'study',
      startDate: startTime,
      endDate: endTime,
      allDay: false,
      reminderMinutes: 30,
    });

    slotIndex++;
  }

  // Add exam event
  const examStartTime = new Date(exam);
  examStartTime.setHours(hours, minutes, 0, 0);
  
  events.push({
    userId,
    courseId,
    title: `📝 Exam: ${course.title}`,
    description: `Exam for course: ${course.title}`,
    eventType: 'exam',
    startDate: examStartTime,
    endDate: null,
    allDay: true,
    reminderMinutes: 1440, // 24 hours before
  });

  // Bulk create events
  const createdCount = await CalendarModel.bulkCreate(events);

  logger.info(`Study plan generated for course ${courseId}: ${createdCount} events created`);

  return {
    courseId,
    courseTitle: course.title,
    chaptersCount: chapters.length,
    eventsCreated: createdCount,
    studySessionsPerDay: sessionsPerDay,
    sessionDuration,
    examDate: exam.toISOString(),
    firstStudyDate: events[0]?.startDate?.toISOString(),
    lastStudyDate: events[events.length - 2]?.startDate?.toISOString(), // -2 because last is exam
  };
}

/**
 * Get available study days between two dates
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @param {Array<number>} allowedDays - Allowed days of week
 * @returns {Array<Date>} Available dates
 */
function getAvailableStudyDays(start, end, allowedDays) {
  const days = [];
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // Start from tomorrow
  
  while (current < end) {
    if (allowedDays.includes(current.getDay())) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

/**
 * Get upcoming events (next 7 days)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Upcoming events
 */
async function getUpcomingEvents(userId) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);
  
  return CalendarModel.findByDateRange(userId, start, end);
}

/**
 * Get today's events
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Today's events
 */
async function getTodayEvents(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return CalendarModel.findByDateRange(userId, today, tomorrow);
}

/**
 * Get event statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Statistics
 */
async function getEventStats(userId) {
  const countByType = await CalendarModel.getCountByType(userId);
  const upcoming = await getUpcomingEvents(userId);
  const today = await getTodayEvents(userId);
  
  return {
    total: Object.values(countByType).reduce((a, b) => a + b, 0),
    byType: countByType,
    upcomingCount: upcoming.length,
    todayCount: today.length,
  };
}

module.exports = {
  createEvent,
  getEvents,
  getEventsByDateRange,
  getEvent,
  updateEvent,
  deleteEvent,
  generateStudyPlan,
  getUpcomingEvents,
  getTodayEvents,
  getEventStats,
};
