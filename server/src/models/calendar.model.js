/**
 * Calendar Model
 * Database operations for calendar_events table
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new calendar event
 * @param {Object} eventData - Event details
 * @returns {Promise<Object>} Created event
 */
async function create(eventData) {
  const id = uuidv4();
  const {
    userId,
    courseId = null,
    title,
    description = null,
    eventType = 'other',
    startDate,
    endDate = null,
    allDay = false,
    recurrenceRule = null,
    reminderMinutes = 60,
  } = eventData;

  const [result] = await db.query(
    `INSERT INTO calendar_events 
     (id, user_id, course_id, title, description, event_type, start_date, end_date, all_day, recurrence_rule, reminder_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, courseId, title, description, eventType, startDate, endDate, allDay, recurrenceRule, reminderMinutes]
  );

  return findById(id);
}

/**
 * Find event by ID
 * @param {string} id - Event ID
 * @returns {Promise<Object|null>} Event or null
 */
async function findById(id) {
  const [rows] = await db.query(
    `SELECT ce.*, c.title as course_title
     FROM calendar_events ce
     LEFT JOIN courses c ON ce.course_id = c.id
     WHERE ce.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Find all events for a user
 * @param {string} userId - User ID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Events list
 */
async function findByUser(userId, options = {}) {
  const { startDate, endDate, eventType, courseId } = options;
  
  let query = `
    SELECT ce.*, c.title as course_title
    FROM calendar_events ce
    LEFT JOIN courses c ON ce.course_id = c.id
    WHERE ce.user_id = ?
  `;
  const params = [userId];

  if (startDate) {
    query += ` AND ce.start_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND ce.start_date <= ?`;
    params.push(endDate);
  }

  if (eventType) {
    query += ` AND ce.event_type = ?`;
    params.push(eventType);
  }

  if (courseId) {
    query += ` AND ce.course_id = ?`;
    params.push(courseId);
  }

  query += ` ORDER BY ce.start_date ASC`;

  const [rows] = await db.query(query, params);
  return rows;
}

/**
 * Find events by date range for a user
 * @param {string} userId - User ID
 * @param {Date} startDate - Range start
 * @param {Date} endDate - Range end
 * @returns {Promise<Array>} Events list
 */
async function findByDateRange(userId, startDate, endDate) {
  const [rows] = await db.query(
    `SELECT ce.*, c.title as course_title
     FROM calendar_events ce
     LEFT JOIN courses c ON ce.course_id = c.id
     WHERE ce.user_id = ? 
       AND ce.start_date >= ? 
       AND ce.start_date <= ?
     ORDER BY ce.start_date ASC`,
    [userId, startDate, endDate]
  );
  return rows;
}

/**
 * Find upcoming events with reminders due
 * @param {number} withinMinutes - Check events starting within this many minutes
 * @returns {Promise<Array>} Events needing reminders
 */
async function findUpcomingReminders(withinMinutes = 1440) {
  const [rows] = await db.query(
    `SELECT ce.*, u.email, u.first_name, u.language_preference
     FROM calendar_events ce
     JOIN users u ON ce.user_id = u.id
     WHERE ce.reminder_sent = FALSE
       AND ce.reminder_minutes IS NOT NULL
       AND ce.start_date > NOW()
       AND TIMESTAMPDIFF(MINUTE, NOW(), ce.start_date) <= ce.reminder_minutes
       AND TIMESTAMPDIFF(MINUTE, NOW(), ce.start_date) > 0
     ORDER BY ce.start_date ASC`,
    []
  );
  return rows;
}

/**
 * Mark reminder as sent
 * @param {string} id - Event ID
 * @returns {Promise<boolean>} Success
 */
async function markReminderSent(id) {
  const [result] = await db.query(
    `UPDATE calendar_events SET reminder_sent = TRUE WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Update an event
 * @param {string} id - Event ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated event
 */
async function update(id, updates) {
  const allowedFields = [
    'title', 'description', 'event_type', 'start_date', 'end_date',
    'all_day', 'recurrence_rule', 'reminder_minutes', 'course_id'
  ];

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(snakeKey)) {
      fields.push(`${snakeKey} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return findById(id);

  values.push(id);
  await db.query(
    `UPDATE calendar_events SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
    values
  );

  return findById(id);
}

/**
 * Delete an event
 * @param {string} id - Event ID
 * @returns {Promise<boolean>} Success
 */
async function deleteById(id) {
  const [result] = await db.query(
    `DELETE FROM calendar_events WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Delete all events for a course
 * @param {string} courseId - Course ID
 * @returns {Promise<number>} Number of deleted events
 */
async function deleteByCourse(courseId) {
  const [result] = await db.query(
    `DELETE FROM calendar_events WHERE course_id = ?`,
    [courseId]
  );
  return result.affectedRows;
}

/**
 * Delete study events for a course (for regenerating study plan)
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @returns {Promise<number>} Number of deleted events
 */
async function deleteStudyEventsByCourse(userId, courseId) {
  const [result] = await db.query(
    `DELETE FROM calendar_events 
     WHERE user_id = ? AND course_id = ? AND event_type = 'study'`,
    [userId, courseId]
  );
  return result.affectedRows;
}

/**
 * Bulk create events (for study plan generation)
 * @param {Array} events - Array of event objects
 * @returns {Promise<number>} Number of created events
 */
async function bulkCreate(events) {
  if (!events || events.length === 0) return 0;

  const values = events.map(event => [
    uuidv4(),
    event.userId,
    event.courseId || null,
    event.title,
    event.description || null,
    event.eventType || 'study',
    event.startDate,
    event.endDate || null,
    event.allDay || false,
    event.recurrenceRule || null,
    event.reminderMinutes || 60,
  ]);

  const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const flatValues = values.flat();

  const [result] = await db.query(
    `INSERT INTO calendar_events 
     (id, user_id, course_id, title, description, event_type, start_date, end_date, all_day, recurrence_rule, reminder_minutes)
     VALUES ${placeholders}`,
    flatValues
  );

  return result.affectedRows;
}

/**
 * Get event count by type for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Count by type
 */
async function getCountByType(userId) {
  const [rows] = await db.query(
    `SELECT event_type, COUNT(*) as count
     FROM calendar_events
     WHERE user_id = ?
     GROUP BY event_type`,
    [userId]
  );
  
  return rows.reduce((acc, row) => {
    acc[row.event_type] = row.count;
    return acc;
  }, {});
}

module.exports = {
  create,
  findById,
  findByUser,
  findByDateRange,
  findUpcomingReminders,
  markReminderSent,
  update,
  deleteById,
  deleteByCourse,
  deleteStudyEventsByCourse,
  bulkCreate,
  getCountByType,
};
