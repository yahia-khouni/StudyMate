/**
 * Material Model
 * Database operations for materials table
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

/**
 * Create a new material record
 * @param {Object} materialData
 * @returns {Promise<Object>}
 */
async function create({ chapterId, originalFilename, storedFilename, filePath, fileSize, mimeType }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO materials (id, chapter_id, original_filename, stored_filename, file_path, file_size, mime_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, chapterId, originalFilename, storedFilename, filePath, fileSize, mimeType]
  );
  
  return findById(id);
}

/**
 * Find material by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await db.query(
    `SELECT * FROM materials WHERE id = ?`,
    [id]
  );
  return rows[0] ? formatMaterial(rows[0]) : null;
}

/**
 * Find material by ID with chapter and course info
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findByIdWithChapter(id) {
  const [rows] = await db.query(
    `SELECT m.*, 
            ch.title as chapter_title,
            ch.course_id,
            c.user_id as course_user_id,
            c.name as course_name
     FROM materials m
     JOIN chapters ch ON m.chapter_id = ch.id
     JOIN courses c ON ch.course_id = c.id
     WHERE m.id = ?`,
    [id]
  );
  
  if (!rows[0]) return null;
  
  const material = formatMaterial(rows[0]);
  material.chapter = {
    id: rows[0].chapter_id,
    title: rows[0].chapter_title,
    courseId: rows[0].course_id,
  };
  material.course = {
    userId: rows[0].course_user_id,
    name: rows[0].course_name,
  };
  
  return material;
}

/**
 * Find all materials for a chapter
 * @param {string} chapterId
 * @returns {Promise<Array>}
 */
async function findByChapter(chapterId) {
  const [rows] = await db.query(
    `SELECT * FROM materials WHERE chapter_id = ? ORDER BY created_at ASC`,
    [chapterId]
  );
  return rows.map(formatMaterial);
}

/**
 * Find materials by status
 * @param {string} status
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function findByStatus(status, limit = 10) {
  const [rows] = await db.query(
    `SELECT m.*, ch.course_id
     FROM materials m
     JOIN chapters ch ON m.chapter_id = ch.id
     WHERE m.status = ?
     ORDER BY m.created_at ASC
     LIMIT ?`,
    [status, limit]
  );
  return rows.map(formatMaterial);
}

/**
 * Update material
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function update(id, { status, processingError, extractedText, structuredContent, processedAt }) {
  const updates = [];
  const values = [];
  
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }
  if (processingError !== undefined) {
    updates.push('processing_error = ?');
    values.push(processingError);
  }
  if (extractedText !== undefined) {
    updates.push('extracted_text = ?');
    values.push(extractedText);
  }
  if (structuredContent !== undefined) {
    updates.push('structured_content = ?');
    values.push(structuredContent);
  }
  if (processedAt !== undefined) {
    updates.push('processed_at = ?');
    values.push(processedAt);
  }
  
  if (updates.length === 0) return findById(id);
  
  values.push(id);
  await db.query(
    `UPDATE materials SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return findById(id);
}

/**
 * Update material status
 * @param {string} id
 * @param {string} status
 * @param {string} error - Optional error message
 * @returns {Promise<void>}
 */
async function updateStatus(id, status, error = null) {
  await db.query(
    `UPDATE materials SET status = ?, processing_error = ? WHERE id = ?`,
    [status, error, id]
  );
}

/**
 * Delete a material
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function remove(id) {
  const [result] = await db.query(
    `DELETE FROM materials WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Delete all materials for a chapter
 * @param {string} chapterId
 * @returns {Promise<number>} Number of deleted materials
 */
async function removeByChapter(chapterId) {
  const [result] = await db.query(
    `DELETE FROM materials WHERE chapter_id = ?`,
    [chapterId]
  );
  return result.affectedRows;
}

/**
 * Get total size of materials for a user
 * @param {string} userId
 * @returns {Promise<number>} Total size in bytes
 */
async function getTotalSizeByUser(userId) {
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(m.file_size), 0) as total_size
     FROM materials m
     JOIN chapters ch ON m.chapter_id = ch.id
     JOIN courses c ON ch.course_id = c.id
     WHERE c.user_id = ?`,
    [userId]
  );
  return rows[0].total_size;
}

/**
 * Format material object for API response
 * @param {Object} material
 * @returns {Object}
 */
function formatMaterial(material) {
  if (!material) return null;
  
  return {
    id: material.id,
    chapterId: material.chapter_id,
    originalFilename: material.original_filename,
    storedFilename: material.stored_filename,
    filePath: material.file_path,
    fileSize: material.file_size,
    mimeType: material.mime_type,
    status: material.status,
    processingError: material.processing_error,
    extractedText: material.extracted_text,
    structuredContent: material.structured_content,
    processedAt: material.processed_at,
    createdAt: material.created_at,
    updatedAt: material.updated_at,
  };
}

module.exports = {
  create,
  findById,
  findByIdWithChapter,
  findByChapter,
  findByStatus,
  update,
  updateStatus,
  remove,
  removeByChapter,
  getTotalSizeByUser,
  formatMaterial,
};
