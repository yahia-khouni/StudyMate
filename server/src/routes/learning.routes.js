/**
 * Learning Routes
 * API endpoints for AI-powered learning tools:
 * - Summaries
 * - Quizzes
 * - Flashcards
 * - RAG Chat
 */

const express = require('express');
const router = express.Router();

// Controllers
const summaryController = require('../controllers/summary.controller');
const quizController = require('../controllers/quiz.controller');
const flashcardController = require('../controllers/flashcard.controller');
const chatController = require('../controllers/chat.controller');

// Middleware
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ============================================================================
// SUMMARY ROUTES
// ============================================================================

/**
 * @route   GET /api/chapters/:chapterId/summary
 * @desc    Get summary for a chapter (query: language)
 * @access  Private
 */
router.get('/chapters/:chapterId/summary', summaryController.getSummary);

/**
 * @route   GET /api/chapters/:chapterId/summaries
 * @desc    Get all summaries for a chapter (both languages)
 * @access  Private
 */
router.get('/chapters/:chapterId/summaries', summaryController.getChapterSummaries);

/**
 * @route   POST /api/chapters/:chapterId/summary/generate
 * @desc    Generate a summary for a chapter
 * @access  Private
 */
router.post('/chapters/:chapterId/summary/generate', summaryController.generateSummary);

/**
 * @route   POST /api/summaries/:summaryId/regenerate
 * @desc    Regenerate an existing summary
 * @access  Private
 */
router.post('/summaries/:summaryId/regenerate', summaryController.regenerateSummary);

/**
 * @route   DELETE /api/summaries/:summaryId
 * @desc    Delete a summary
 * @access  Private
 */
router.delete('/summaries/:summaryId', summaryController.deleteSummary);

// ============================================================================
// QUIZ ROUTES
// ============================================================================

/**
 * @route   GET /api/quizzes/:quizId
 * @desc    Get a quiz by ID (includes questions)
 * @access  Private
 */
router.get('/quizzes/:quizId', quizController.getQuiz);

/**
 * @route   DELETE /api/quizzes/:quizId
 * @desc    Delete a quiz
 * @access  Private
 */
router.delete('/quizzes/:quizId', quizController.deleteQuiz);

/**
 * @route   GET /api/quizzes/:quizId/best-attempt
 * @desc    Get user's best attempt for a quiz
 * @access  Private
 */
router.get('/quizzes/:quizId/best-attempt', quizController.getBestAttempt);

/**
 * @route   POST /api/quizzes/:quizId/attempt
 * @desc    Submit a quiz attempt
 * @access  Private
 */
router.post('/quizzes/:quizId/attempt', quizController.submitAttempt);

/**
 * @route   GET /api/chapters/:chapterId/quizzes
 * @desc    Get all quizzes for a chapter
 * @access  Private
 */
router.get('/chapters/:chapterId/quizzes', quizController.getChapterQuizzes);

/**
 * @route   POST /api/chapters/:chapterId/quiz/generate
 * @desc    Generate a quiz for a chapter
 * @access  Private
 */
router.post('/chapters/:chapterId/quiz/generate', quizController.generateQuiz);

/**
 * @route   GET /api/courses/:courseId/quizzes
 * @desc    Get all quizzes for a course
 * @access  Private
 */
router.get('/courses/:courseId/quizzes', quizController.getCourseQuizzes);

/**
 * @route   GET /api/quiz-attempts
 * @desc    Get user's quiz attempts (query: courseId, limit)
 * @access  Private
 */
router.get('/quiz-attempts', quizController.getUserAttempts);

/**
 * @route   GET /api/quiz-attempts/:attemptId/review
 * @desc    Get detailed review of a quiz attempt
 * @access  Private
 */
router.get('/quiz-attempts/:attemptId/review', quizController.getAttemptReview);

/**
 * @route   GET /api/quiz-stats
 * @desc    Get user's quiz statistics (query: courseId)
 * @access  Private
 */
router.get('/quiz-stats', quizController.getUserStats);

// ============================================================================
// FLASHCARD ROUTES
// ============================================================================

/**
 * @route   GET /api/flashcard-decks/:deckId
 * @desc    Get a flashcard deck by ID (includes cards)
 * @access  Private
 */
router.get('/flashcard-decks/:deckId', flashcardController.getDeck);

/**
 * @route   GET /api/flashcard-decks/:deckId/with-progress
 * @desc    Get deck with user's progress on each card
 * @access  Private
 */
router.get('/flashcard-decks/:deckId/with-progress', flashcardController.getDeckWithProgress);

/**
 * @route   GET /api/flashcard-decks/:deckId/progress
 * @desc    Get deck progress statistics
 * @access  Private
 */
router.get('/flashcard-decks/:deckId/progress', flashcardController.getDeckProgress);

/**
 * @route   DELETE /api/flashcard-decks/:deckId
 * @desc    Delete a flashcard deck
 * @access  Private
 */
router.delete('/flashcard-decks/:deckId', flashcardController.deleteDeck);

/**
 * @route   GET /api/chapters/:chapterId/flashcard-decks
 * @desc    Get all flashcard decks for a chapter
 * @access  Private
 */
router.get('/chapters/:chapterId/flashcard-decks', flashcardController.getChapterDecks);

/**
 * @route   POST /api/chapters/:chapterId/flashcards/generate
 * @desc    Generate flashcards for a chapter
 * @access  Private
 */
router.post('/chapters/:chapterId/flashcards/generate', flashcardController.generateFlashcards);

/**
 * @route   GET /api/courses/:courseId/flashcard-decks
 * @desc    Get all flashcard decks for a course
 * @access  Private
 */
router.get('/courses/:courseId/flashcard-decks', flashcardController.getCourseDecks);

/**
 * @route   GET /api/flashcards/review
 * @desc    Get cards due for review (query: deckId, limit)
 * @access  Private
 */
router.get('/flashcards/review', flashcardController.getCardsForReview);

/**
 * @route   POST /api/flashcards/:flashcardId/review
 * @desc    Record a flashcard review (SM-2 algorithm)
 * @access  Private
 */
router.post('/flashcards/:flashcardId/review', flashcardController.recordReview);

/**
 * @route   PUT /api/flashcards/:flashcardId
 * @desc    Update a flashcard's content
 * @access  Private
 */
router.put('/flashcards/:flashcardId', flashcardController.updateCard);

/**
 * @route   GET /api/flashcard-stats
 * @desc    Get user's flashcard statistics (query: courseId)
 * @access  Private
 */
router.get('/flashcard-stats', flashcardController.getUserStats);

// ============================================================================
// CHAT ROUTES
// ============================================================================

/**
 * @route   POST /api/courses/:courseId/chat
 * @desc    Start a new chat session for a course (body: message - optional initial message)
 * @access  Private
 */
router.post('/courses/:courseId/chat', chatController.startChat);

/**
 * @route   GET /api/courses/:courseId/chat-sessions
 * @desc    Get all chat sessions for a course
 * @access  Private
 */
router.get('/courses/:courseId/chat-sessions', chatController.getCourseSessions);

/**
 * @route   GET /api/chat-sessions
 * @desc    Get all user's chat sessions (query: limit)
 * @access  Private
 */
router.get('/chat-sessions', chatController.getUserSessions);

/**
 * @route   GET /api/chat-sessions/:sessionId
 * @desc    Get a chat session with messages
 * @access  Private
 */
router.get('/chat-sessions/:sessionId', chatController.getSession);

/**
 * @route   PUT /api/chat-sessions/:sessionId
 * @desc    Update chat session title
 * @access  Private
 */
router.put('/chat-sessions/:sessionId', chatController.updateSession);

/**
 * @route   DELETE /api/chat-sessions/:sessionId
 * @desc    Delete a chat session
 * @access  Private
 */
router.delete('/chat-sessions/:sessionId', chatController.deleteSession);

/**
 * @route   POST /api/chat-sessions/:sessionId/messages
 * @desc    Send a message in a chat session
 * @access  Private
 */
router.post('/chat-sessions/:sessionId/messages', chatController.sendMessage);

/**
 * @route   GET /api/chat-stats
 * @desc    Get user's chat statistics (query: courseId)
 * @access  Private
 */
router.get('/chat-stats', chatController.getUserStats);

module.exports = router;
