/**
 * Course Model
 * Database operations for courses table
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

/**
 * Create a new course
 * @param {Object} courseData
 * @returns {Promise<Object>}
 */
async function create({ userId, name, description, syllabus, language = 'en', color = '#6366f1' }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO courses (id, user_id, name, description, syllabus, language, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, name, description, syllabus, language, color]
  );
  
  return findById(id);
}

/**
 * Find course by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await db.query(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM chapters WHERE course_id = c.id) as chapter_count,
            (SELECT COUNT(*) FROM chapters WHERE course_id = c.id AND status = 'completed') as completed_chapters
     FROM courses c
     WHERE c.id = ?`,
    [id]
  );
  return rows[0] ? formatCourse(rows[0]) : null;
}

/**
 * Find course by ID with ownership check
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function findByIdAndUser(id, userId) {
  const [rows] = await db.query(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM chapters WHERE course_id = c.id) as chapter_count,
            (SELECT COUNT(*) FROM chapters WHERE course_id = c.id AND status = 'completed') as completed_chapters
     FROM courses c
     WHERE c.id = ? AND c.user_id = ?`,
    [id, userId]
  );
  return rows[0] ? formatCourse(rows[0]) : null;
}

/**
 * Find all courses for a user
 * @param {string} userId
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function findByUser(userId, { limit = 50, offset = 0, sortBy = 'updated_at', sortOrder = 'DESC' } = {}) {
  // Validate sort parameters
  const allowedSortFields = ['name', 'created_at', 'updated_at'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'updated_at';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  const [rows] = await db.query(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM chapters WHERE course_id = c.id) as chapter_count,
            (SELECT COUNT(*) FROM chapters WHERE course_id = c.id AND status = 'completed') as completed_chapters
     FROM courses c
     WHERE c.user_id = ?
     ORDER BY c.${sortField} ${order}
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  
  return rows.map(formatCourse);
}

/**
 * Count courses for a user
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function countByUser(userId) {
  const [rows] = await db.query(
    `SELECT COUNT(*) as count FROM courses WHERE user_id = ?`,
    [userId]
  );
  return rows[0].count;
}

/**
 * Update a course
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function update(id, { name, description, syllabus, language, color }) {
  const updates = [];
  const values = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (syllabus !== undefined) {
    updates.push('syllabus = ?');
    values.push(syllabus);
  }
  if (language !== undefined) {
    updates.push('language = ?');
    values.push(language);
  }
  if (color !== undefined) {
    updates.push('color = ?');
    values.push(color);
  }
  
  if (updates.length === 0) return findById(id);
  
  values.push(id);
  await db.query(
    `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return findById(id);
}

/**
 * Delete a course
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function remove(id) {
  const [result] = await db.query(
    `DELETE FROM courses WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Format course object for API response
 * @param {Object} course
 * @returns {Object}
 */
function formatCourse(course) {
  if (!course) return null;
  
  const chapterCount = course.chapter_count || 0;
  const completedChapters = course.completed_chapters || 0;
  const progress = chapterCount > 0 ? Math.round((completedChapters / chapterCount) * 100) : 0;
  
  return {
    id: course.id,
    userId: course.user_id,
    title: course.name, // Map name to title for frontend
    name: course.name,  // Keep name for backward compatibility
    description: course.description,
    syllabus: course.syllabus,
    language: course.language,
    color: course.color,
    chapterCount,
    completedChapters,
    progress,
    createdAt: course.created_at,
    updatedAt: course.updated_at,
  };
}

module.exports = {
  create,
  findById,
  findByIdAndUser,
  findByUser,
  countByUser,
  update,
  remove,
  formatCourse,
};
