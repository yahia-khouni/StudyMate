/**
 * Summary Model
 * Database operations for summaries table
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

/**
 * Create a new summary
 * @param {Object} summaryData
 * @returns {Promise<Object>}
 */
async function create({ chapterId, language, content }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO summaries (id, chapter_id, language, content)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE content = ?, updated_at = NOW()`,
    [id, chapterId, language, content, content]
  );
  
  // Return the created/updated summary
  return findByChapterAndLanguage(chapterId, language);
}

/**
 * Find summary by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await db.query(
    `SELECT s.*, ch.title as chapter_title, ch.course_id
     FROM summaries s
     JOIN chapters ch ON s.chapter_id = ch.id
     WHERE s.id = ?`,
    [id]
  );
  return rows[0] ? formatSummary(rows[0]) : null;
}

/**
 * Find summary by chapter ID and language
 * @param {string} chapterId
 * @param {string} language - 'en' or 'fr'
 * @returns {Promise<Object|null>}
 */
async function findByChapterAndLanguage(chapterId, language) {
  const [rows] = await db.query(
    `SELECT s.*, ch.title as chapter_title, ch.course_id
     FROM summaries s
     JOIN chapters ch ON s.chapter_id = ch.id
     WHERE s.chapter_id = ? AND s.language = ?`,
    [chapterId, language]
  );
  return rows[0] ? formatSummary(rows[0]) : null;
}

/**
 * Find all summaries for a chapter
 * @param {string} chapterId
 * @returns {Promise<Array>}
 */
async function findByChapter(chapterId) {
  const [rows] = await db.query(
    `SELECT s.*, ch.title as chapter_title, ch.course_id
     FROM summaries s
     JOIN chapters ch ON s.chapter_id = ch.id
     WHERE s.chapter_id = ?
     ORDER BY s.language ASC`,
    [chapterId]
  );
  return rows.map(formatSummary);
}

/**
 * Find all summaries for a course
 * @param {string} courseId
 * @returns {Promise<Array>}
 */
async function findByCourse(courseId) {
  const [rows] = await db.query(
    `SELECT s.*, ch.title as chapter_title, ch.course_id
     FROM summaries s
     JOIN chapters ch ON s.chapter_id = ch.id
     WHERE ch.course_id = ?
     ORDER BY ch.order_index ASC, s.language ASC`,
    [courseId]
  );
  return rows.map(formatSummary);
}

/**
 * Update a summary
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function update(id, { content }) {
  if (!content) return findById(id);
  
  await db.query(
    `UPDATE summaries SET content = ? WHERE id = ?`,
    [content, id]
  );
  
  return findById(id);
}

/**
 * Delete a summary
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function remove(id) {
  const [result] = await db.query(
    `DELETE FROM summaries WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Delete all summaries for a chapter
 * @param {string} chapterId
 * @returns {Promise<boolean>}
 */
async function removeByChapter(chapterId) {
  const [result] = await db.query(
    `DELETE FROM summaries WHERE chapter_id = ?`,
    [chapterId]
  );
  return result.affectedRows > 0;
}

/**
 * Check if summary exists for chapter and language
 * @param {string} chapterId
 * @param {string} language
 * @returns {Promise<boolean>}
 */
async function exists(chapterId, language) {
  const [rows] = await db.query(
    `SELECT 1 FROM summaries WHERE chapter_id = ? AND language = ?`,
    [chapterId, language]
  );
  return rows.length > 0;
}

/**
 * Format summary object for API response
 * @param {Object} summary
 * @returns {Object}
 */
function formatSummary(summary) {
  if (!summary) return null;
  
  return {
    id: summary.id,
    chapterId: summary.chapter_id,
    chapterTitle: summary.chapter_title,
    courseId: summary.course_id,
    language: summary.language,
    content: summary.content,
    createdAt: summary.created_at,
    updatedAt: summary.updated_at,
  };
}

module.exports = {
  create,
  findById,
  findByChapterAndLanguage,
  findByChapter,
  findByCourse,
  update,
  remove,
  removeByChapter,
  exists,
  formatSummary,
};
