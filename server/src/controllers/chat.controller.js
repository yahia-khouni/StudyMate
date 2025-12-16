/**
 * Chat Controller
 * Handles HTTP requests for RAG-powered chat functionality
 */

const chatService = require('../services/chat.service');
const logger = require('../config/logger');

/**
 * Start a new chat session for a course
 * POST /api/courses/:courseId/chat
 */
async function startChat(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    const { message } = req.body;
    
    const result = await chatService.startChat(courseId, userId, message);
    
    res.status(201).json({
      success: true,
      message: 'Chat session started',
      data: result,
    });
  } catch (error) {
    logger.error('Start chat error:', error);
    next(error);
  }
}

/**
 * Get a chat session with messages
 * GET /api/chat-sessions/:sessionId
 */
async function getSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    
    const session = await chatService.getSession(sessionId, userId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found',
      });
    }
    
    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error('Get chat session error:', error);
    next(error);
  }
}

/**
 * Get all chat sessions for a course
 * GET /api/courses/:courseId/chat-sessions
 */
async function getCourseSessions(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    
    const sessions = await chatService.getCoursesSessions(courseId, userId);
    
    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error('Get course chat sessions error:', error);
    next(error);
  }
}

/**
 * Get all user's chat sessions
 * GET /api/chat-sessions
 */
async function getUserSessions(req, res, next) {
  try {
    const userId = req.user.id;
    const { limit } = req.query;
    
    const sessions = await chatService.getUserSessions(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    
    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error('Get user chat sessions error:', error);
    next(error);
  }
}

/**
 * Send a message in a chat session
 * POST /api/chat-sessions/:sessionId/messages
 */
async function sendMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { message } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }
    
    const result = await chatService.sendMessage(sessionId, userId, message.trim());
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Send message error:', error);
    next(error);
  }
}

/**
 * Update session title
 * PUT /api/chat-sessions/:sessionId
 */
async function updateSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { title } = req.body;
    
    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }
    
    const session = await chatService.updateSessionTitle(sessionId, userId, title);
    
    res.json({
      success: true,
      message: 'Session updated successfully',
      data: session,
    });
  } catch (error) {
    logger.error('Update chat session error:', error);
    next(error);
  }
}

/**
 * Delete a chat session
 * DELETE /api/chat-sessions/:sessionId
 */
async function deleteSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    
    await chatService.deleteSession(sessionId, userId);
    
    res.json({
      success: true,
      message: 'Chat session deleted successfully',
    });
  } catch (error) {
    logger.error('Delete chat session error:', error);
    next(error);
  }
}

/**
 * Get user's chat statistics
 * GET /api/chat-stats
 */
async function getUserStats(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.query;
    
    const stats = await chatService.getUserStats(userId, courseId);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get user chat stats error:', error);
    next(error);
  }
}

module.exports = {
  startChat,
  getSession,
  getCourseSessions,
  getUserSessions,
  sendMessage,
  updateSession,
  deleteSession,
  getUserStats,
};
