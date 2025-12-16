/**
 * Flashcard Controller
 * Handles HTTP requests for flashcard decks and spaced repetition
 */

const flashcardService = require('../services/flashcard.service');
const logger = require('../config/logger');

/**
 * Get a flashcard deck by ID
 * GET /api/flashcard-decks/:deckId
 */
async function getDeck(req, res, next) {
  try {
    const { deckId } = req.params;
    
    const deck = await flashcardService.getDeck(deckId);
    
    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Flashcard deck not found',
      });
    }
    
    res.json({
      success: true,
      data: deck,
    });
  } catch (error) {
    logger.error('Get flashcard deck error:', error);
    next(error);
  }
}

/**
 * Get deck with user's progress on each card
 * GET /api/flashcard-decks/:deckId/with-progress
 */
async function getDeckWithProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const { deckId } = req.params;
    
    const deck = await flashcardService.getDeckWithProgress(deckId, userId);
    
    res.json({
      success: true,
      data: deck,
    });
  } catch (error) {
    logger.error('Get deck with progress error:', error);
    next(error);
  }
}

/**
 * Get all flashcard decks for a chapter
 * GET /api/chapters/:chapterId/flashcard-decks
 */
async function getChapterDecks(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { language } = req.query;
    
    const decks = await flashcardService.getChapterDecks(chapterId, language);
    
    res.json({
      success: true,
      data: decks,
    });
  } catch (error) {
    logger.error('Get chapter flashcard decks error:', error);
    next(error);
  }
}

/**
 * Get all flashcard decks for a course
 * GET /api/courses/:courseId/flashcard-decks
 */
async function getCourseDecks(req, res, next) {
  try {
    const { courseId } = req.params;
    
    const decks = await flashcardService.getCourseDecks(courseId);
    
    res.json({
      success: true,
      data: decks,
    });
  } catch (error) {
    logger.error('Get course flashcard decks error:', error);
    next(error);
  }
}

/**
 * Generate flashcards for a chapter
 * POST /api/chapters/:chapterId/flashcards/generate
 */
async function generateFlashcards(req, res, next) {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    const { language, cardCount } = req.body;
    
    const deck = await flashcardService.generateFlashcards(chapterId, userId, {
      language,
      cardCount,
    });
    
    res.status(201).json({
      success: true,
      message: 'Flashcards generated successfully',
      data: deck,
    });
  } catch (error) {
    logger.error('Generate flashcards error:', error);
    next(error);
  }
}

/**
 * Get cards due for review
 * GET /api/flashcards/review
 */
async function getCardsForReview(req, res, next) {
  try {
    const userId = req.user.id;
    const { deckId, limit } = req.query;
    
    const cards = await flashcardService.getCardsForReview(
      userId,
      deckId,
      limit ? parseInt(limit, 10) : undefined
    );
    
    res.json({
      success: true,
      data: cards,
      count: cards.length,
    });
  } catch (error) {
    logger.error('Get cards for review error:', error);
    next(error);
  }
}

/**
 * Record a flashcard review
 * POST /api/flashcards/:flashcardId/review
 */
async function recordReview(req, res, next) {
  try {
    const userId = req.user.id;
    const { flashcardId } = req.params;
    const { quality } = req.body;
    
    if (typeof quality !== 'number' || quality < 0 || quality > 5) {
      return res.status(400).json({
        success: false,
        message: 'Quality rating must be a number between 0 and 5',
      });
    }
    
    const result = await flashcardService.recordReview(flashcardId, userId, quality);
    
    res.json({
      success: true,
      message: 'Review recorded',
      data: result,
    });
  } catch (error) {
    logger.error('Record flashcard review error:', error);
    next(error);
  }
}

/**
 * Get deck progress statistics
 * GET /api/flashcard-decks/:deckId/progress
 */
async function getDeckProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const { deckId } = req.params;
    
    const progress = await flashcardService.getDeckProgress(deckId, userId);
    
    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error('Get deck progress error:', error);
    next(error);
  }
}

/**
 * Get user's flashcard statistics
 * GET /api/flashcard-stats
 */
async function getUserStats(req, res, next) {
  try {
    const userId = req.user.id;
    const { courseId } = req.query;
    
    const stats = await flashcardService.getUserStats(userId, courseId);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get user flashcard stats error:', error);
    next(error);
  }
}

/**
 * Update a flashcard
 * PUT /api/flashcards/:flashcardId
 */
async function updateCard(req, res, next) {
  try {
    const userId = req.user.id;
    const { flashcardId } = req.params;
    const { frontContent, backContent } = req.body;
    
    const card = await flashcardService.updateCard(flashcardId, userId, {
      frontContent,
      backContent,
    });
    
    res.json({
      success: true,
      message: 'Flashcard updated successfully',
      data: card,
    });
  } catch (error) {
    logger.error('Update flashcard error:', error);
    next(error);
  }
}

/**
 * Delete a flashcard deck
 * DELETE /api/flashcard-decks/:deckId
 */
async function deleteDeck(req, res, next) {
  try {
    const userId = req.user.id;
    const { deckId } = req.params;
    
    await flashcardService.deleteDeck(deckId, userId);
    
    res.json({
      success: true,
      message: 'Flashcard deck deleted successfully',
    });
  } catch (error) {
    logger.error('Delete flashcard deck error:', error);
    next(error);
  }
}

module.exports = {
  getDeck,
  getDeckWithProgress,
  getChapterDecks,
  getCourseDecks,
  generateFlashcards,
  getCardsForReview,
  recordReview,
  getDeckProgress,
  getUserStats,
  updateCard,
  deleteDeck,
};
