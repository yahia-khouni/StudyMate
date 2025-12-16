/**
 * Chat Model
 * Database operations for chat_sessions and chat_messages tables
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

// =====================================================
// CHAT SESSION OPERATIONS
// =====================================================

/**
 * Create a new chat session
 * @param {Object} sessionData
 * @returns {Promise<Object>}
 */
async function createSession({ courseId, userId, title = null }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO chat_sessions (id, course_id, user_id, title)
     VALUES (?, ?, ?, ?)`,
    [id, courseId, userId, title]
  );
  
  return findSessionById(id);
}

/**
 * Find session by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findSessionById(id) {
  const [rows] = await db.query(
    `SELECT s.*, c.name as course_name, c.language as course_language
     FROM chat_sessions s
     JOIN courses c ON s.course_id = c.id
     WHERE s.id = ?`,
    [id]
  );
  return rows[0] ? formatSession(rows[0]) : null;
}

/**
 * Find session by ID with messages
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findSessionByIdWithMessages(id) {
  const session = await findSessionById(id);
  if (!session) return null;
  
  session.messages = await findMessagesBySession(id);
  return session;
}

/**
 * Find all sessions for a course and user
 * @param {string} courseId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function findSessionsByCourseAndUser(courseId, userId) {
  const [rows] = await db.query(
    `SELECT s.*, c.name as course_name, c.language as course_language,
            (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as message_count
     FROM chat_sessions s
     JOIN courses c ON s.course_id = c.id
     WHERE s.course_id = ? AND s.user_id = ?
     ORDER BY s.updated_at DESC`,
    [courseId, userId]
  );
  return rows.map(formatSession);
}

/**
 * Find all sessions for a user
 * @param {string} userId
 * @param {Object} options - Optional filters { limit }
 * @returns {Promise<Array>}
 */
async function findSessionsByUser(userId, options = {}) {
  let query = `
    SELECT s.*, c.name as course_name, c.language as course_language,
           (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as message_count
    FROM chat_sessions s
    JOIN courses c ON s.course_id = c.id
    WHERE s.user_id = ?
    ORDER BY s.updated_at DESC`;
  
  const params = [userId];
  
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  const [rows] = await db.query(query, params);
  return rows.map(formatSession);
}

/**
 * Update session title
 * @param {string} id
 * @param {string} title
 * @returns {Promise<Object|null>}
 */
async function updateSessionTitle(id, title) {
  await db.query(
    `UPDATE chat_sessions SET title = ? WHERE id = ?`,
    [title, id]
  );
  return findSessionById(id);
}

/**
 * Update session timestamp (called when new message added)
 * @param {string} id
 * @returns {Promise<void>}
 */
async function touchSession(id) {
  await db.query(
    `UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?`,
    [id]
  );
}

/**
 * Delete a session (cascade deletes messages)
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function removeSession(id) {
  const [result] = await db.query(
    `DELETE FROM chat_sessions WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

// =====================================================
// CHAT MESSAGE OPERATIONS
// =====================================================

/**
 * Create a new chat message
 * @param {Object} messageData
 * @returns {Promise<Object>}
 */
async function createMessage({ sessionId, role, content, sources = null }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO chat_messages (id, session_id, role, content, sources)
     VALUES (?, ?, ?, ?, ?)`,
    [id, sessionId, role, content, sources ? JSON.stringify(sources) : null]
  );
  
  // Update session timestamp
  await touchSession(sessionId);
  
  // If this is the first user message, auto-generate session title
  const session = await findSessionById(sessionId);
  if (role === 'user' && !session.title) {
    // Use first 50 chars of the message as title
    const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
    await updateSessionTitle(sessionId, title);
  }
  
  return findMessageById(id);
}

/**
 * Find message by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findMessageById(id) {
  const [rows] = await db.query(
    `SELECT m.*, s.course_id
     FROM chat_messages m
     JOIN chat_sessions s ON m.session_id = s.id
     WHERE m.id = ?`,
    [id]
  );
  return rows[0] ? formatMessage(rows[0]) : null;
}

/**
 * Find all messages for a session
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
async function findMessagesBySession(sessionId) {
  const [rows] = await db.query(
    `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId]
  );
  return rows.map(formatMessage);
}

/**
 * Get recent messages for context (last N messages)
 * @param {string} sessionId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getRecentMessages(sessionId, limit = 10) {
  const [rows] = await db.query(
    `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
    [sessionId, limit]
  );
  // Return in chronological order
  return rows.reverse().map(formatMessage);
}

/**
 * Delete a message
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function removeMessage(id) {
  const [result] = await db.query(
    `DELETE FROM chat_messages WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

// =====================================================
// STATISTICS
// =====================================================

/**
 * Get chat statistics for a user
 * @param {string} userId
 * @param {string} courseId - Optional course filter
 * @returns {Promise<Object>}
 */
async function getUserChatStats(userId, courseId = null) {
  let query = `
    SELECT 
      COUNT(DISTINCT s.id) as total_sessions,
      COUNT(m.id) as total_messages,
      SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) as user_messages,
      SUM(CASE WHEN m.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON s.id = m.session_id
    WHERE s.user_id = ?`;
  
  const params = [userId];
  
  if (courseId) {
    query += ' AND s.course_id = ?';
    params.push(courseId);
  }
  
  const [rows] = await db.query(query, params);
  
  return {
    totalSessions: rows[0].total_sessions || 0,
    totalMessages: rows[0].total_messages || 0,
    userMessages: rows[0].user_messages || 0,
    assistantMessages: rows[0].assistant_messages || 0,
  };
}

// =====================================================
// FORMAT FUNCTIONS
// =====================================================

/**
 * Format session object for API response
 * @param {Object} session
 * @returns {Object}
 */
function formatSession(session) {
  if (!session) return null;
  
  return {
    id: session.id,
    courseId: session.course_id,
    courseName: session.course_name,
    courseLanguage: session.course_language,
    userId: session.user_id,
    title: session.title,
    messageCount: session.message_count || 0,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

/**
 * Format message object for API response
 * @param {Object} message
 * @returns {Object}
 */
function formatMessage(message) {
  if (!message) return null;
  
  return {
    id: message.id,
    sessionId: message.session_id,
    courseId: message.course_id,
    role: message.role,
    content: message.content,
    sources: message.sources ? 
      (typeof message.sources === 'string' ? JSON.parse(message.sources) : message.sources) 
      : null,
    createdAt: message.created_at,
  };
}

module.exports = {
  // Sessions
  createSession,
  findSessionById,
  findSessionByIdWithMessages,
  findSessionsByCourseAndUser,
  findSessionsByUser,
  updateSessionTitle,
  touchSession,
  removeSession,
  formatSession,
  
  // Messages
  createMessage,
  findMessageById,
  findMessagesBySession,
  getRecentMessages,
  removeMessage,
  formatMessage,
  
  // Statistics
  getUserChatStats,
};
