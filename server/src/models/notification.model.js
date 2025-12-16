/**
 * Notification Model
 * Database operations for notifications table
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

/**
 * Notification types
 */
const NOTIFICATION_TYPES = {
  PROCESSING_COMPLETE: 'processing_complete',
  DEADLINE_REMINDER: 'deadline_reminder',
  QUIZ_PASSED: 'quiz_passed',
  STREAK_REMINDER: 'streak_reminder',
  BADGE_EARNED: 'badge_earned',
};

/**
 * Create a new notification
 * @param {Object} notificationData
 * @returns {Promise<Object>}
 */
async function create({ userId, type, title, message, linkUrl = null }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO notifications (id, user_id, type, title, message, link_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, type, title, message, linkUrl]
  );
  
  return findById(id);
}

/**
 * Find notification by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await db.query(
    `SELECT * FROM notifications WHERE id = ?`,
    [id]
  );
  return rows[0] ? formatNotification(rows[0]) : null;
}

/**
 * Find all notifications for a user
 * @param {string} userId
 * @param {Object} options
 * @returns {Promise<{notifications: Array, unreadCount: number}>}
 */
async function findByUser(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
  let query = `SELECT * FROM notifications WHERE user_id = ?`;
  const values = [userId];
  
  if (unreadOnly) {
    query += ` AND is_read = FALSE`;
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  values.push(limit, offset);
  
  const [rows] = await db.query(query, values);
  
  // Get unread count
  const [countResult] = await db.query(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
    [userId]
  );
  
  return {
    notifications: rows.map(formatNotification),
    unreadCount: countResult[0].count,
  };
}

/**
 * Get recent notifications for a user
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function findRecent(userId, limit = 10) {
  const [rows] = await db.query(
    `SELECT * FROM notifications 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ?`,
    [userId, limit]
  );
  return rows.map(formatNotification);
}

/**
 * Get unread count for a user
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getUnreadCount(userId) {
  const [rows] = await db.query(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
    [userId]
  );
  return rows[0].count;
}

/**
 * Mark a notification as read
 * @param {string} id
 * @param {string} userId - For ownership verification
 * @returns {Promise<boolean>}
 */
async function markAsRead(id, userId) {
  const [result] = await db.query(
    `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId
 * @returns {Promise<number>} Number of notifications marked
 */
async function markAllAsRead(userId) {
  const [result] = await db.query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`,
    [userId]
  );
  return result.affectedRows;
}

/**
 * Delete a notification
 * @param {string} id
 * @param {string} userId - For ownership verification
 * @returns {Promise<boolean>}
 */
async function remove(id, userId) {
  const [result] = await db.query(
    `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Delete all notifications for a user
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function removeAll(userId) {
  const [result] = await db.query(
    `DELETE FROM notifications WHERE user_id = ?`,
    [userId]
  );
  return result.affectedRows;
}

/**
 * Delete old read notifications
 * @param {number} daysOld
 * @returns {Promise<number>}
 */
async function cleanupOld(daysOld = 30) {
  const [result] = await db.query(
    `DELETE FROM notifications 
     WHERE is_read = TRUE 
     AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [daysOld]
  );
  return result.affectedRows;
}

/**
 * Update email sent status
 * @param {string} id
 * @returns {Promise<void>}
 */
async function markEmailSent(id) {
  await db.query(
    `UPDATE notifications SET email_sent = TRUE, email_sent_at = NOW() WHERE id = ?`,
    [id]
  );
}

/**
 * Find notifications that need email sending
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function findPendingEmails(limit = 50) {
  const [rows] = await db.query(
    `SELECT n.*, u.email, u.first_name
     FROM notifications n
     JOIN users u ON n.user_id = u.id
     WHERE n.email_sent = FALSE 
     AND n.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
     ORDER BY n.created_at ASC
     LIMIT ?`,
    [limit]
  );
  return rows.map(row => ({
    ...formatNotification(row),
    userEmail: row.email,
    userFirstName: row.first_name,
  }));
}

/**
 * Format notification object for API response
 * @param {Object} notification
 * @returns {Object}
 */
function formatNotification(notification) {
  if (!notification) return null;
  
  return {
    id: notification.id,
    userId: notification.user_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkUrl: notification.link_url,
    isRead: Boolean(notification.is_read),
    emailSent: Boolean(notification.email_sent),
    emailSentAt: notification.email_sent_at,
    createdAt: notification.created_at,
  };
}

module.exports = {
  NOTIFICATION_TYPES,
  create,
  findById,
  findByUser,
  findRecent,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  remove,
  removeAll,
  cleanupOld,
  markEmailSent,
  findPendingEmails,
  formatNotification,
};
