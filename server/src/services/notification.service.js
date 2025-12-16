/**
 * Notification Service
 * Handles notification creation and WebSocket broadcasting
 */

const NotificationModel = require('../models/notification.model');
const logger = require('../config/logger');

// WebSocket server reference (set from main server)
let io = null;

// Connected users map: userId -> Set of socket IDs
const connectedUsers = new Map();

/**
 * Initialize WebSocket integration
 * @param {SocketIO.Server} socketServer
 */
function initializeWebSocket(socketServer) {
  io = socketServer;
  
  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);
    
    // Authenticate user on connection
    socket.on('authenticate', (userId) => {
      if (userId) {
        // Add socket to user's set
        if (!connectedUsers.has(userId)) {
          connectedUsers.set(userId, new Set());
        }
        connectedUsers.get(userId).add(socket.id);
        
        // Join user-specific room
        socket.join(`user:${userId}`);
        
        logger.info(`User ${userId} authenticated on socket ${socket.id}`);
        
        // Send unread count on connection
        getUnreadCountForSocket(userId, socket);
      }
    });
    
    socket.on('disconnect', () => {
      // Remove socket from all user sets
      for (const [userId, sockets] of connectedUsers.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            connectedUsers.delete(userId);
          }
          break;
        }
      }
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
    
    // Handle mark as read
    socket.on('notification:markRead', async ({ notificationId, userId }) => {
      try {
        await NotificationModel.markAsRead(notificationId, userId);
        emitToUser(userId, 'notification:updated', { id: notificationId, isRead: true });
      } catch (error) {
        logger.error('Error marking notification as read:', error);
      }
    });
    
    // Handle mark all as read
    socket.on('notification:markAllRead', async ({ userId }) => {
      try {
        await NotificationModel.markAllAsRead(userId);
        emitToUser(userId, 'notification:allRead', {});
      } catch (error) {
        logger.error('Error marking all notifications as read:', error);
      }
    });
  });
  
  logger.info('WebSocket notification service initialized');
}

/**
 * Get unread count and emit to socket
 * @param {string} userId
 * @param {Socket} socket
 */
async function getUnreadCountForSocket(userId, socket) {
  try {
    const count = await NotificationModel.getUnreadCount(userId);
    socket.emit('notification:unreadCount', { count });
  } catch (error) {
    logger.error('Error getting unread count:', error);
  }
}

/**
 * Emit event to specific user
 * @param {string} userId
 * @param {string} event
 * @param {Object} data
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Emitted ${event} to user ${userId}`);
  }
}

/**
 * Emit event to all connected clients
 * @param {string} event
 * @param {Object} data
 */
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Create notification and emit to user
 * @param {Object} notificationData
 * @returns {Promise<Object>}
 */
async function createNotification({ userId, type, title, message, linkUrl = null }) {
  try {
    const notification = await NotificationModel.create({
      userId,
      type,
      title,
      message,
      linkUrl,
    });
    
    // Emit to user via WebSocket
    emitToUser(userId, 'notification:new', notification);
    
    // Also emit updated unread count
    const unreadCount = await NotificationModel.getUnreadCount(userId);
    emitToUser(userId, 'notification:unreadCount', { count: unreadCount });
    
    logger.info(`Notification created for user ${userId}: ${type}`);
    
    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Send processing complete notification
 * @param {string} userId
 * @param {string} courseId
 * @param {string} chapterId
 * @param {string} chapterTitle
 * @param {string} courseName
 * @returns {Promise<Object>}
 */
async function notifyProcessingComplete(userId, courseId, chapterId, chapterTitle, courseName) {
  return createNotification({
    userId,
    type: NotificationModel.NOTIFICATION_TYPES.PROCESSING_COMPLETE,
    title: 'Document Processing Complete',
    message: `Your materials for "${chapterTitle}" in ${courseName} have been processed and are ready for study.`,
    linkUrl: `/courses/${courseId}`,
  });
}

/**
 * Send processing failed notification
 * @param {string} userId
 * @param {string} chapterTitle
 * @param {string} error
 * @returns {Promise<Object>}
 */
async function notifyProcessingFailed(userId, chapterTitle, error) {
  // Truncate error message if too long
  const truncatedError = error && error.length > 200 ? error.substring(0, 200) + '...' : error;
  
  return createNotification({
    userId,
    type: NotificationModel.NOTIFICATION_TYPES.PROCESSING_COMPLETE, // Using same type, title indicates failure
    title: 'Document Processing Failed',
    message: `There was an error processing your materials for "${chapterTitle}": ${truncatedError}. Please try uploading again.`,
    linkUrl: null,
  });
}

/**
 * Emit job progress update
 * @param {string} userId
 * @param {string} jobId
 * @param {number} progress
 * @param {string} status
 * @param {Object} extra
 */
function emitJobProgress(userId, jobId, progress, status, extra = {}) {
  emitToUser(userId, 'job:progress', {
    jobId,
    progress,
    status,
    ...extra,
  });
}

/**
 * Emit job completion
 * @param {string} userId
 * @param {string} jobId
 * @param {Object} result
 */
function emitJobComplete(userId, jobId, result = {}) {
  emitToUser(userId, 'job:complete', {
    jobId,
    ...result,
  });
}

/**
 * Emit job failure
 * @param {string} userId
 * @param {string} jobId
 * @param {string} error
 */
function emitJobFailed(userId, jobId, error) {
  emitToUser(userId, 'job:failed', {
    jobId,
    error,
  });
}

/**
 * Get user notifications
 * @param {string} userId
 * @param {Object} options
 * @returns {Promise<{notifications: Array, unreadCount: number}>}
 */
async function getUserNotifications(userId, options = {}) {
  return NotificationModel.findByUser(userId, options);
}

/**
 * Get recent notifications
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getRecentNotifications(userId, limit = 10) {
  return NotificationModel.findRecent(userId, limit);
}

/**
 * Mark notification as read
 * @param {string} notificationId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function markAsRead(notificationId, userId) {
  const result = await NotificationModel.markAsRead(notificationId, userId);
  
  if (result) {
    // Emit updated unread count
    const unreadCount = await NotificationModel.getUnreadCount(userId);
    emitToUser(userId, 'notification:unreadCount', { count: unreadCount });
  }
  
  return result;
}

/**
 * Mark all notifications as read
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function markAllAsRead(userId) {
  const count = await NotificationModel.markAllAsRead(userId);
  
  // Emit updated unread count
  emitToUser(userId, 'notification:unreadCount', { count: 0 });
  emitToUser(userId, 'notification:allRead', {});
  
  return count;
}

/**
 * Delete notification
 * @param {string} notificationId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function deleteNotification(notificationId, userId) {
  return NotificationModel.remove(notificationId, userId);
}

/**
 * Check if user is connected
 * @param {string} userId
 * @returns {boolean}
 */
function isUserConnected(userId) {
  return connectedUsers.has(userId) && connectedUsers.get(userId).size > 0;
}

/**
 * Get connected user count
 * @returns {number}
 */
function getConnectedUserCount() {
  return connectedUsers.size;
}

module.exports = {
  initializeWebSocket,
  emitToUser,
  emitToAll,
  createNotification,
  notifyProcessingComplete,
  notifyProcessingFailed,
  emitJobProgress,
  emitJobComplete,
  emitJobFailed,
  getUserNotifications,
  getRecentNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  isUserConnected,
  getConnectedUserCount,
};
