/**
 * Notification Controller
 * Handles HTTP requests for notification operations
 */

const notificationService = require('../services/notification.service');
const NotificationModel = require('../models/notification.model');
const logger = require('../config/logger');

/**
 * Get user notifications
 * GET /api/notifications
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;
    
    const result = await notificationService.getUserNotifications(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true',
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get recent notifications
 * GET /api/notifications/recent
 */
async function getRecentNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;
    
    const notifications = await notificationService.getRecentNotifications(
      userId,
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.id;
    const count = await NotificationModel.getUnreadCount(userId);
    
    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
async function markAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const success = await notificationService.markAsRead(id, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const count = await notificationService.markAllAsRead(userId);
    
    res.json({
      success: true,
      message: `${count} notifications marked as read`,
      data: { markedCount: count },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
async function deleteNotification(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const success = await notificationService.deleteNotification(id, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete all notifications
 * DELETE /api/notifications
 */
async function deleteAllNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const count = await NotificationModel.removeAll(userId);
    
    res.json({
      success: true,
      message: `${count} notifications deleted`,
      data: { deletedCount: count },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotifications,
  getRecentNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};
