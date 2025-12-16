/**
 * Flashcard Service
 * Business logic for flashcard decks and spaced repetition
 */

const FlashcardModel = require('../models/flashcard.model');
const ChapterModel = require('../models/chapter.model');
const MaterialModel = require('../models/material.model');
const aiService = require('./ai.service');
const logger = require('../config/logger');

// Default configuration
const DEFAULTS = {
  CARD_COUNT: 10,
  REVIEW_LIMIT: 20,
};

/**
 * Get a flashcard deck by ID
 * @param {string} deckId
 * @returns {Promise<Object|null>}
 */
async function getDeck(deckId) {
  return FlashcardModel.findDeckById(deckId);
}

/**
 * Get all decks for a chapter
 * @param {string} chapterId
 * @param {string} language - Optional filter
 * @returns {Promise<Array>}
 */
async function getChapterDecks(chapterId, language = null) {
  return FlashcardModel.findDecksByChapter(chapterId, language);
}

/**
 * Get all decks for a course
 * @param {string} courseId
 * @returns {Promise<Array>}
 */
async function getCourseDecks(courseId) {
  return FlashcardModel.findDecksByCourse(courseId);
}

/**
 * Generate and save flashcards for a chapter
 * @param {string} chapterId
 * @param {string} userId
 * @param {Object} options - { language, cardCount }
 * @returns {Promise<Object>}
 */
async function generateFlashcards(chapterId, userId, options = {}) {
  // Get chapter with course info
  const chapter = await ChapterModel.findByIdWithCourse(chapterId);
  
  if (!chapter) {
    throw new Error('Chapter not found');
  }
  
  // Verify user owns the course
  if (chapter.course.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  // Get content from materials (structured content preferred, fallback to extracted text)
  const materials = await MaterialModel.findByChapter(chapterId);
  const completedMaterials = materials.filter(m => m.status === 'completed');
  
  if (completedMaterials.length === 0) {
    throw new Error('Chapter has no processed materials. Please upload and process materials first.');
  }
  
  // Combine content from all completed materials
  const contentParts = completedMaterials.map(m => {
    const content = m.structuredContent || m.extractedText;
    return content ? `## ${m.originalFilename}\n\n${content}` : '';
  }).filter(Boolean);
  
  if (contentParts.length === 0) {
    throw new Error('No content available from processed materials.');
  }
  
  const combinedContent = contentParts.join('\n\n---\n\n');
  
  const language = options.language || chapter.course.language || 'en';
  const cardCount = options.cardCount || DEFAULTS.CARD_COUNT;
  
  logger.info(`Generating ${cardCount} flashcards for chapter ${chapterId} in ${language}`);
  
  try {
    // Generate flashcards using AI
    const cards = await aiService.generateFlashcards(
      combinedContent,
      language,
      cardCount
    );
    
    // Create deck name
    const name = `${chapter.title} - Flashcards`;
    
    // Save deck with cards
    const deck = await FlashcardModel.createDeck({
      chapterId,
      name,
      language,
      cards,
    });
    
    logger.info(`Flashcard deck created for chapter ${chapterId}: ${deck.id} with ${cards.length} cards`);
    
    return deck;
  } catch (error) {
    logger.error(`Failed to generate flashcards for chapter ${chapterId}:`, error.message);
    throw error;
  }
}

/**
 * Get cards due for review
 * @param {string} userId
 * @param {string} deckId - Optional deck filter
 * @param {number} limit - Maximum cards to return
 * @returns {Promise<Array>}
 */
async function getCardsForReview(userId, deckId = null, limit = DEFAULTS.REVIEW_LIMIT) {
  return FlashcardModel.getCardsDueForReview(userId, deckId, limit);
}

/**
 * Record a review response using SM-2 algorithm
 * @param {string} flashcardId
 * @param {string} userId
 * @param {number} quality - Response quality (0-5)
 * @returns {Promise<Object>}
 */
async function recordReview(flashcardId, userId, quality) {
  // Validate quality rating
  if (typeof quality !== 'number' || quality < 0 || quality > 5) {
    throw new Error('Quality rating must be a number between 0 and 5');
  }
  
  // Get card to verify it exists
  const card = await FlashcardModel.findCardById(flashcardId);
  if (!card) {
    throw new Error('Flashcard not found');
  }
  
  // Update progress with SM-2 algorithm
  const progress = await FlashcardModel.updateProgressSM2(flashcardId, userId, quality);
  
  logger.info(`Review recorded for flashcard ${flashcardId}: quality=${quality}, next review in ${progress.intervalDays} days`);
  
  return {
    flashcardId,
    quality,
    progress,
  };
}

/**
 * Get deck progress statistics
 * @param {string} deckId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getDeckProgress(deckId, userId) {
  const deck = await FlashcardModel.findDeckByIdBasic(deckId);
  
  if (!deck) {
    throw new Error('Deck not found');
  }
  
  const stats = await FlashcardModel.getDeckProgressStats(deckId, userId);
  
  return {
    deck: {
      id: deck.id,
      name: deck.name,
      chapterId: deck.chapterId,
      chapterTitle: deck.chapterTitle,
    },
    ...stats,
    completionPercentage: stats.totalCards > 0 
      ? Math.round((stats.knownCards / stats.totalCards) * 100) 
      : 0,
  };
}

/**
 * Get user's flashcard statistics
 * @param {string} userId
 * @param {string} courseId - Optional filter
 * @returns {Promise<Object>}
 */
async function getUserStats(userId, courseId = null) {
  return FlashcardModel.getUserFlashcardStats(userId, courseId);
}

/**
 * Get deck with progress for each card
 * @param {string} deckId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getDeckWithProgress(deckId, userId) {
  const deck = await FlashcardModel.findDeckById(deckId);
  
  if (!deck) {
    throw new Error('Deck not found');
  }
  
  // Get progress for each card
  const cardsWithProgress = await Promise.all(
    deck.cards.map(async (card) => {
      const progress = await FlashcardModel.getOrCreateProgress(card.id, userId);
      return {
        ...card,
        progress,
      };
    })
  );
  
  deck.cards = cardsWithProgress;
  
  // Add overall stats
  deck.stats = await FlashcardModel.getDeckProgressStats(deckId, userId);
  
  return deck;
}

/**
 * Delete a flashcard deck
 * @param {string} deckId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function deleteDeck(deckId, userId) {
  const deck = await FlashcardModel.findDeckByIdBasic(deckId);
  
  if (!deck) {
    throw new Error('Deck not found');
  }
  
  // Verify user owns the chapter's course
  const chapter = await ChapterModel.findByIdWithCourse(deck.chapterId);
  if (!chapter || chapter.course.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return FlashcardModel.removeDeck(deckId);
}

/**
 * Update a flashcard's content
 * @param {string} flashcardId
 * @param {string} userId
 * @param {Object} updates - { frontContent, backContent }
 * @returns {Promise<Object>}
 */
async function updateCard(flashcardId, userId, updates) {
  const card = await FlashcardModel.findCardById(flashcardId);
  
  if (!card) {
    throw new Error('Flashcard not found');
  }
  
  // Get deck to verify ownership
  const deck = await FlashcardModel.findDeckByIdBasic(card.deckId);
  if (!deck) {
    throw new Error('Deck not found');
  }
  
  const chapter = await ChapterModel.findByIdWithCourse(deck.chapterId);
  if (!chapter || chapter.course.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return FlashcardModel.updateCard(flashcardId, updates);
}

module.exports = {
  getDeck,
  getChapterDecks,
  getCourseDecks,
  generateFlashcards,
  getCardsForReview,
  recordReview,
  getDeckProgress,
  getUserStats,
  getDeckWithProgress,
  deleteDeck,
  updateCard,
  DEFAULTS,
};
