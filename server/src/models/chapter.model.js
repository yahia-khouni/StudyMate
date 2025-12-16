/**
 * Chapter Model
 * Database operations for chapters table
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

/**
 * Create a new chapter
 * @param {Object} chapterData
 * @returns {Promise<Object>}
 */
async function create({ courseId, title, description, orderIndex }) {
  const id = generateId();
  
  // If no order index provided, get the next one
  if (orderIndex === undefined) {
    const [maxOrder] = await db.query(
      `SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM chapters WHERE course_id = ?`,
      [courseId]
    );
    orderIndex = maxOrder[0].next_order;
  }
  
  await db.query(
    `INSERT INTO chapters (id, course_id, title, description, order_index)
     VALUES (?, ?, ?, ?, ?)`,
    [id, courseId, title, description, orderIndex]
  );
  
  return findById(id);
}

/**
 * Find chapter by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await db.query(
    `SELECT ch.*,
            (SELECT COUNT(*) FROM materials WHERE chapter_id = ch.id) as material_count,
            (SELECT COUNT(*) FROM materials WHERE chapter_id = ch.id AND status = 'completed') as processed_materials
     FROM chapters ch
     WHERE ch.id = ?`,
    [id]
  );
  return rows[0] ? formatChapter(rows[0]) : null;
}

/**
 * Find chapter by ID with course info
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findByIdWithCourse(id) {
  const [rows] = await db.query(
    `SELECT ch.*,
            c.user_id as course_user_id,
            c.name as course_name,
            c.language as course_language,
            (SELECT COUNT(*) FROM materials WHERE chapter_id = ch.id) as material_count,
            (SELECT COUNT(*) FROM materials WHERE chapter_id = ch.id AND status = 'completed') as processed_materials
     FROM chapters ch
     JOIN courses c ON ch.course_id = c.id
     WHERE ch.id = ?`,
    [id]
  );
  
  if (!rows[0]) return null;
  
  const chapter = formatChapter(rows[0]);
  chapter.course = {
    userId: rows[0].course_user_id,
    name: rows[0].course_name,
    language: rows[0].course_language,
  };
  
  return chapter;
}

/**
 * Find all chapters for a course
 * @param {string} courseId
 * @returns {Promise<Array>}
 */
async function findByCourse(courseId) {
  const [rows] = await db.query(
    `SELECT ch.*,
            (SELECT COUNT(*) FROM materials WHERE chapter_id = ch.id) as material_count,
            (SELECT COUNT(*) FROM materials WHERE chapter_id = ch.id AND status = 'completed') as processed_materials
     FROM chapters ch
     WHERE ch.course_id = ?
     ORDER BY ch.order_index ASC`,
    [courseId]
  );
  
  return rows.map(formatChapter);
}

/**
 * Update a chapter
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function update(id, { title, description, status, processedContent, completedAt }) {
  const updates = [];
  const values = [];
  
  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }
  if (processedContent !== undefined) {
    updates.push('processed_content = ?');
    values.push(processedContent);
    updates.push('processed_at = NOW()');
  }
  if (completedAt !== undefined) {
    updates.push('completed_at = ?');
    values.push(completedAt);
  }
  
  if (updates.length === 0) return findById(id);
  
  values.push(id);
  await db.query(
    `UPDATE chapters SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return findById(id);
}

/**
 * Update chapter status
 * @param {string} id
 * @param {string} status
 * @returns {Promise<void>}
 */
async function updateStatus(id, status) {
  const updates = ['status = ?'];
  const values = [status];
  
  if (status === 'completed') {
    updates.push('completed_at = NOW()');
  }
  
  values.push(id);
  await db.query(
    `UPDATE chapters SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Reorder chapters
 * @param {string} courseId
 * @param {Array<{id: string, orderIndex: number}>} orders
 * @returns {Promise<void>}
 */
async function reorder(courseId, orders) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    for (const { id, orderIndex } of orders) {
      await connection.query(
        `UPDATE chapters SET order_index = ? WHERE id = ? AND course_id = ?`,
        [orderIndex, id, courseId]
      );
    }
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Delete a chapter
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function remove(id) {
  const [result] = await db.query(
    `DELETE FROM chapters WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Get next/previous chapters for navigation
 * @param {string} chapterId
 * @param {string} courseId
 * @returns {Promise<{prev: Object|null, next: Object|null}>}
 */
async function getNavigation(chapterId, courseId) {
  const [current] = await db.query(
    `SELECT order_index FROM chapters WHERE id = ?`,
    [chapterId]
  );
  
  if (!current[0]) return { prev: null, next: null };
  
  const currentOrder = current[0].order_index;
  
  const [prev] = await db.query(
    `SELECT id, title FROM chapters 
     WHERE course_id = ? AND order_index < ? 
     ORDER BY order_index DESC LIMIT 1`,
    [courseId, currentOrder]
  );
  
  const [next] = await db.query(
    `SELECT id, title FROM chapters 
     WHERE course_id = ? AND order_index > ? 
     ORDER BY order_index ASC LIMIT 1`,
    [courseId, currentOrder]
  );
  
  return {
    prev: prev[0] ? { id: prev[0].id, title: prev[0].title } : null,
    next: next[0] ? { id: next[0].id, title: next[0].title } : null,
  };
}

/**
 * Format chapter object for API response
 * @param {Object} chapter
 * @returns {Object}
 */
function formatChapter(chapter) {
  if (!chapter) return null;
  
  return {
    id: chapter.id,
    courseId: chapter.course_id,
    title: chapter.title,
    description: chapter.description,
    orderIndex: chapter.order_index,
    status: chapter.status,
    processedContent: chapter.processed_content,
    processedAt: chapter.processed_at,
    completedAt: chapter.completed_at,
    materialCount: chapter.material_count || 0,
    processedMaterials: chapter.processed_materials || 0,
    createdAt: chapter.created_at,
    updatedAt: chapter.updated_at,
  };
}

module.exports = {
  create,
  findById,
  findByIdWithCourse,
  findByCourse,
  update,
  updateStatus,
  reorder,
  remove,
  getNavigation,
  formatChapter,
};
