/**
 * Chat Service
 * Business logic for RAG-powered chat functionality
 */

const ChatModel = require('../models/chat.model');
const CourseModel = require('../models/course.model');
const aiService = require('./ai.service');
const embeddingService = require('./embedding.service');
const logger = require('../config/logger');

// Configuration
const CONFIG = {
  MAX_CONTEXT_CHUNKS: 5,
  MAX_CHAT_HISTORY: 10,
};

/**
 * Get or create a chat session for a course
 * @param {string} courseId
 * @param {string} userId
 * @param {string} sessionId - Optional existing session ID
 * @returns {Promise<Object>}
 */
async function getOrCreateSession(courseId, userId, sessionId = null) {
  // If session ID provided, try to get it
  if (sessionId) {
    const session = await ChatModel.findSessionById(sessionId);
    
    if (session && session.userId === userId && session.courseId === courseId) {
      return session;
    }
  }
  
  // Create new session
  return ChatModel.createSession({ courseId, userId });
}

/**
 * Get a chat session with messages
 * @param {string} sessionId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getSession(sessionId, userId) {
  const session = await ChatModel.findSessionByIdWithMessages(sessionId);
  
  if (!session) {
    return null;
  }
  
  // Verify ownership
  if (session.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return session;
}

/**
 * Get all chat sessions for a course
 * @param {string} courseId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getCoursesSessions(courseId, userId) {
  return ChatModel.findSessionsByCourseAndUser(courseId, userId);
}

/**
 * Get all user's chat sessions
 * @param {string} userId
 * @param {Object} options - { limit }
 * @returns {Promise<Array>}
 */
async function getUserSessions(userId, options = {}) {
  return ChatModel.findSessionsByUser(userId, options);
}

/**
 * Send a message and get AI response
 * @param {string} sessionId
 * @param {string} userId
 * @param {string} message
 * @returns {Promise<{userMessage: Object, assistantMessage: Object}>}
 */
async function sendMessage(sessionId, userId, message) {
  // Get session to verify ownership and get course info
  const session = await ChatModel.findSessionById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  // Save user message
  const userMessage = await ChatModel.createMessage({
    sessionId,
    role: 'user',
    content: message,
  });
  
  logger.info(`User message saved for session ${sessionId}`);
  
  try {
    // Get chat history for context
    const recentMessages = await ChatModel.getRecentMessages(sessionId, CONFIG.MAX_CHAT_HISTORY);
    const chatHistory = recentMessages
      .filter(m => m.id !== userMessage.id) // Exclude current message
      .map(m => ({
        role: m.role,
        content: m.content,
      }));
    
    // Query relevant content from vector store
    let contextChunks = [];
    try {
      const queryResults = await embeddingService.querySimilarContent(
        session.courseId,
        message,
        CONFIG.MAX_CONTEXT_CHUNKS
      );
      
      // New format: array of {content, similarity, metadata, chapterId}
      if (queryResults && queryResults.length > 0) {
        contextChunks = queryResults.map(result => ({
          content: result.content,
          metadata: {
            ...result.metadata,
            chapterId: result.chapterId,
            materialId: result.materialId,
            similarity: result.similarity,
          },
        }));
        logger.info(`[CHAT] Found ${contextChunks.length} relevant chunks for query`);
      }
    } catch (embeddingError) {
      logger.warn(`Failed to retrieve context from vector store: ${embeddingError.message}`);
      // Continue without context - AI will indicate it can't find specific info
    }
    
    // Generate AI response
    const { response, sources } = await aiService.generateChatResponse(
      message,
      contextChunks,
      chatHistory,
      session.courseLanguage
    );
    
    // Save assistant message
    const assistantMessage = await ChatModel.createMessage({
      sessionId,
      role: 'assistant',
      content: response,
      sources: sources.length > 0 ? sources : null,
    });
    
    logger.info(`Assistant response saved for session ${sessionId}`);
    
    return {
      userMessage,
      assistantMessage,
    };
  } catch (error) {
    logger.error(`Failed to generate chat response for session ${sessionId}:`, error.message);
    
    // Save error message as assistant response
    const errorMessage = await ChatModel.createMessage({
      sessionId,
      role: 'assistant',
      content: 'I apologize, but I encountered an error while processing your question. Please try again.',
    });
    
    return {
      userMessage,
      assistantMessage: errorMessage,
    };
  }
}

/**
 * Start a new chat for a course
 * @param {string} courseId
 * @param {string} userId
 * @param {string} initialMessage - Optional initial message
 * @returns {Promise<Object>}
 */
async function startChat(courseId, userId, initialMessage = null) {
  // Verify user owns the course
  const course = await CourseModel.findById(courseId);
  
  if (!course) {
    throw new Error('Course not found');
  }
  
  if (course.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  // Create new session
  const session = await ChatModel.createSession({ courseId, userId });
  
  // If there's an initial message, process it
  if (initialMessage) {
    const result = await sendMessage(session.id, userId, initialMessage);
    
    return {
      session: await ChatModel.findSessionByIdWithMessages(session.id),
      ...result,
    };
  }
  
  return { session };
}

/**
 * Update session title
 * @param {string} sessionId
 * @param {string} userId
 * @param {string} title
 * @returns {Promise<Object>}
 */
async function updateSessionTitle(sessionId, userId, title) {
  const session = await ChatModel.findSessionById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return ChatModel.updateSessionTitle(sessionId, title);
}

/**
 * Delete a chat session
 * @param {string} sessionId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function deleteSession(sessionId, userId) {
  const session = await ChatModel.findSessionById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return ChatModel.removeSession(sessionId);
}

/**
 * Get user's chat statistics
 * @param {string} userId
 * @param {string} courseId - Optional filter
 * @returns {Promise<Object>}
 */
async function getUserStats(userId, courseId = null) {
  return ChatModel.getUserChatStats(userId, courseId);
}

module.exports = {
  getOrCreateSession,
  getSession,
  getCoursesSessions,
  getUserSessions,
  sendMessage,
  startChat,
  updateSessionTitle,
  deleteSession,
  getUserStats,
  CONFIG,
};
