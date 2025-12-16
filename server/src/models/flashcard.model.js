/**
 * Flashcard Model
 * Database operations for flashcard_decks, flashcards, and flashcard_progress tables
 * Implements SM-2 Spaced Repetition Algorithm
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

// =====================================================
// FLASHCARD DECK OPERATIONS
// =====================================================

/**
 * Create a new flashcard deck with cards
 * @param {Object} deckData
 * @returns {Promise<Object>}
 */
async function createDeck({ chapterId, name, language, cards }) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const deckId = generateId();
    
    // Create deck
    await connection.query(
      `INSERT INTO flashcard_decks (id, chapter_id, name, language, card_count)
       VALUES (?, ?, ?, ?, ?)`,
      [deckId, chapterId, name, language, cards.length]
    );
    
    // Create cards
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cardId = generateId();
      
      await connection.query(
        `INSERT INTO flashcards (id, deck_id, front_content, back_content, card_order)
         VALUES (?, ?, ?, ?, ?)`,
        [cardId, deckId, card.frontContent, card.backContent, i]
      );
    }
    
    await connection.commit();
    
    return findDeckById(deckId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Find deck by ID with cards
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findDeckById(id) {
  const [rows] = await db.query(
    `SELECT d.*, ch.title as chapter_title, ch.course_id
     FROM flashcard_decks d
     JOIN chapters ch ON d.chapter_id = ch.id
     WHERE d.id = ?`,
    [id]
  );
  
  if (!rows[0]) return null;
  
  const deck = formatDeck(rows[0]);
  deck.cards = await findCardsByDeck(id);
  
  return deck;
}

/**
 * Find deck by ID without cards (for listing)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findDeckByIdBasic(id) {
  const [rows] = await db.query(
    `SELECT d.*, ch.title as chapter_title, ch.course_id
     FROM flashcard_decks d
     JOIN chapters ch ON d.chapter_id = ch.id
     WHERE d.id = ?`,
    [id]
  );
  return rows[0] ? formatDeck(rows[0]) : null;
}

/**
 * Find all decks for a chapter
 * @param {string} chapterId
 * @param {string} language - Optional language filter
 * @returns {Promise<Array>}
 */
async function findDecksByChapter(chapterId, language = null) {
  let query = `
    SELECT d.*, ch.title as chapter_title, ch.course_id
    FROM flashcard_decks d
    JOIN chapters ch ON d.chapter_id = ch.id
    WHERE d.chapter_id = ?`;
  
  const params = [chapterId];
  
  if (language) {
    query += ' AND d.language = ?';
    params.push(language);
  }
  
  query += ' ORDER BY d.created_at DESC';
  
  const [rows] = await db.query(query, params);
  return rows.map(formatDeck);
}

/**
 * Find all decks for a course
 * @param {string} courseId
 * @returns {Promise<Array>}
 */
async function findDecksByCourse(courseId) {
  const [rows] = await db.query(
    `SELECT d.*, ch.title as chapter_title, ch.course_id
     FROM flashcard_decks d
     JOIN chapters ch ON d.chapter_id = ch.id
     WHERE ch.course_id = ?
     ORDER BY ch.order_index ASC, d.created_at DESC`,
    [courseId]
  );
  return rows.map(formatDeck);
}

/**
 * Delete a deck (cascade deletes cards and progress)
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function removeDeck(id) {
  const [result] = await db.query(
    `DELETE FROM flashcard_decks WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

// =====================================================
// FLASHCARD OPERATIONS
// =====================================================

/**
 * Find all cards for a deck
 * @param {string} deckId
 * @returns {Promise<Array>}
 */
async function findCardsByDeck(deckId) {
  const [rows] = await db.query(
    `SELECT * FROM flashcards WHERE deck_id = ? ORDER BY card_order ASC`,
    [deckId]
  );
  return rows.map(formatCard);
}

/**
 * Find card by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findCardById(id) {
  const [rows] = await db.query(
    `SELECT f.*, d.chapter_id
     FROM flashcards f
     JOIN flashcard_decks d ON f.deck_id = d.id
     WHERE f.id = ?`,
    [id]
  );
  return rows[0] ? formatCard(rows[0]) : null;
}

/**
 * Update a card
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function updateCard(id, { frontContent, backContent }) {
  const updates = [];
  const values = [];
  
  if (frontContent !== undefined) {
    updates.push('front_content = ?');
    values.push(frontContent);
  }
  if (backContent !== undefined) {
    updates.push('back_content = ?');
    values.push(backContent);
  }
  
  if (updates.length === 0) return findCardById(id);
  
  values.push(id);
  await db.query(
    `UPDATE flashcards SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return findCardById(id);
}

// =====================================================
// FLASHCARD PROGRESS & SM-2 ALGORITHM
// =====================================================

/**
 * Get or create progress for a card and user
 * @param {string} flashcardId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getOrCreateProgress(flashcardId, userId) {
  // Check if progress exists
  const [existing] = await db.query(
    `SELECT * FROM flashcard_progress WHERE flashcard_id = ? AND user_id = ?`,
    [flashcardId, userId]
  );
  
  if (existing[0]) {
    return formatProgress(existing[0]);
  }
  
  // Create new progress
  const id = generateId();
  await db.query(
    `INSERT INTO flashcard_progress (id, flashcard_id, user_id, ease_factor, interval_days, repetitions, status, next_review_date)
     VALUES (?, ?, ?, 2.50, 1, 0, 'learning', CURDATE())`,
    [id, flashcardId, userId]
  );
  
  const [rows] = await db.query(
    `SELECT * FROM flashcard_progress WHERE id = ?`,
    [id]
  );
  
  return formatProgress(rows[0]);
}

/**
 * Update progress using SM-2 algorithm
 * @param {string} flashcardId
 * @param {string} userId
 * @param {number} quality - Response quality (0-5)
 *   0 - Complete blackout
 *   1 - Incorrect, but upon seeing answer, it felt familiar
 *   2 - Incorrect, but upon seeing answer, it seemed easy to remember
 *   3 - Correct response recalled with serious difficulty
 *   4 - Correct response after hesitation
 *   5 - Perfect response
 * @returns {Promise<Object>}
 */
async function updateProgressSM2(flashcardId, userId, quality) {
  // Get current progress
  const progress = await getOrCreateProgress(flashcardId, userId);
  
  // SM-2 Algorithm implementation
  let easeFactor = parseFloat(progress.easeFactor);
  let interval = progress.intervalDays;
  let repetitions = progress.repetitions;
  
  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect response - reset
    repetitions = 0;
    interval = 1;
  }
  
  // Update ease factor
  // EF = EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Minimum ease factor is 1.3
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }
  
  // Determine status
  const status = repetitions >= 3 ? 'known' : 'learning';
  
  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  
  // Update in database
  await db.query(
    `UPDATE flashcard_progress 
     SET ease_factor = ?, interval_days = ?, repetitions = ?, status = ?, 
         next_review_date = ?, last_reviewed_at = NOW()
     WHERE flashcard_id = ? AND user_id = ?`,
    [easeFactor.toFixed(2), interval, repetitions, status, nextReviewDate, flashcardId, userId]
  );
  
  return getOrCreateProgress(flashcardId, userId);
}

/**
 * Get cards due for review for a user
 * @param {string} userId
 * @param {string} deckId - Optional deck filter
 * @param {number} limit - Maximum cards to return
 * @returns {Promise<Array>}
 */
async function getCardsDueForReview(userId, deckId = null, limit = 20) {
  let query = `
    SELECT f.*, fp.ease_factor, fp.interval_days, fp.repetitions, fp.status, 
           fp.next_review_date, fp.last_reviewed_at,
           d.name as deck_name, d.chapter_id, ch.title as chapter_title
    FROM flashcards f
    JOIN flashcard_decks d ON f.deck_id = d.id
    JOIN chapters ch ON d.chapter_id = ch.id
    LEFT JOIN flashcard_progress fp ON f.id = fp.flashcard_id AND fp.user_id = ?
    WHERE (fp.next_review_date IS NULL OR fp.next_review_date <= CURDATE())`;
  
  const params = [userId];
  
  if (deckId) {
    query += ' AND f.deck_id = ?';
    params.push(deckId);
  }
  
  query += ' ORDER BY fp.next_review_date ASC, f.card_order ASC LIMIT ?';
  params.push(limit);
  
  const [rows] = await db.query(query, params);
  
  return rows.map(row => ({
    ...formatCard(row),
    progress: row.ease_factor ? {
      easeFactor: parseFloat(row.ease_factor),
      intervalDays: row.interval_days,
      repetitions: row.repetitions,
      status: row.status,
      nextReviewDate: row.next_review_date,
      lastReviewedAt: row.last_reviewed_at,
    } : null,
    deckName: row.deck_name,
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title,
  }));
}

/**
 * Get deck progress statistics for a user
 * @param {string} deckId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getDeckProgressStats(deckId, userId) {
  const [stats] = await db.query(
    `SELECT 
       COUNT(f.id) as total_cards,
       SUM(CASE WHEN fp.id IS NOT NULL THEN 1 ELSE 0 END) as reviewed_cards,
       SUM(CASE WHEN fp.status = 'known' THEN 1 ELSE 0 END) as known_cards,
       SUM(CASE WHEN fp.status = 'learning' THEN 1 ELSE 0 END) as learning_cards,
       SUM(CASE WHEN fp.next_review_date <= CURDATE() OR fp.id IS NULL THEN 1 ELSE 0 END) as due_cards
     FROM flashcards f
     LEFT JOIN flashcard_progress fp ON f.id = fp.flashcard_id AND fp.user_id = ?
     WHERE f.deck_id = ?`,
    [userId, deckId]
  );
  
  return {
    totalCards: stats[0].total_cards || 0,
    reviewedCards: stats[0].reviewed_cards || 0,
    knownCards: stats[0].known_cards || 0,
    learningCards: stats[0].learning_cards || 0,
    dueCards: stats[0].due_cards || 0,
  };
}

/**
 * Get user flashcard statistics
 * @param {string} userId
 * @param {string} courseId - Optional course filter
 * @returns {Promise<Object>}
 */
async function getUserFlashcardStats(userId, courseId = null) {
  let query = `
    SELECT 
      COUNT(DISTINCT d.id) as decks_studied,
      COUNT(DISTINCT f.id) as total_cards,
      SUM(CASE WHEN fp.status = 'known' THEN 1 ELSE 0 END) as known_cards,
      SUM(CASE WHEN fp.next_review_date <= CURDATE() THEN 1 ELSE 0 END) as due_today
    FROM flashcard_decks d
    JOIN flashcards f ON d.id = f.deck_id
    JOIN chapters ch ON d.chapter_id = ch.id
    LEFT JOIN flashcard_progress fp ON f.id = fp.flashcard_id AND fp.user_id = ?
    WHERE 1=1`;
  
  const params = [userId];
  
  if (courseId) {
    query += ' AND ch.course_id = ?';
    params.push(courseId);
  }
  
  const [rows] = await db.query(query, params);
  
  return {
    decksStudied: rows[0].decks_studied || 0,
    totalCards: rows[0].total_cards || 0,
    knownCards: rows[0].known_cards || 0,
    dueToday: rows[0].due_today || 0,
  };
}

// =====================================================
// FORMAT FUNCTIONS
// =====================================================

/**
 * Format deck object for API response
 * @param {Object} deck
 * @returns {Object}
 */
function formatDeck(deck) {
  if (!deck) return null;
  
  return {
    id: deck.id,
    chapterId: deck.chapter_id,
    chapterTitle: deck.chapter_title,
    courseId: deck.course_id,
    name: deck.name,
    language: deck.language,
    cardCount: deck.card_count,
    createdAt: deck.created_at,
    updatedAt: deck.updated_at,
  };
}

/**
 * Format card object for API response
 * @param {Object} card
 * @returns {Object}
 */
function formatCard(card) {
  if (!card) return null;
  
  return {
    id: card.id,
    deckId: card.deck_id,
    frontContent: card.front_content,
    backContent: card.back_content,
    cardOrder: card.card_order,
  };
}

/**
 * Format progress object for API response
 * @param {Object} progress
 * @returns {Object}
 */
function formatProgress(progress) {
  if (!progress) return null;
  
  return {
    id: progress.id,
    flashcardId: progress.flashcard_id,
    userId: progress.user_id,
    easeFactor: parseFloat(progress.ease_factor),
    intervalDays: progress.interval_days,
    repetitions: progress.repetitions,
    status: progress.status,
    nextReviewDate: progress.next_review_date,
    lastReviewedAt: progress.last_reviewed_at,
    createdAt: progress.created_at,
    updatedAt: progress.updated_at,
  };
}

module.exports = {
  // Decks
  createDeck,
  findDeckById,
  findDeckByIdBasic,
  findDecksByChapter,
  findDecksByCourse,
  removeDeck,
  formatDeck,
  
  // Cards
  findCardsByDeck,
  findCardById,
  updateCard,
  formatCard,
  
  // Progress & SM-2
  getOrCreateProgress,
  updateProgressSM2,
  getCardsDueForReview,
  getDeckProgressStats,
  getUserFlashcardStats,
  formatProgress,
};
