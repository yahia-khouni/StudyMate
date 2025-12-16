/**
 * Vector Store Service
 * SQLite-based vector storage with cosine similarity search
 * 
 * This replaces ChromaDB to avoid memory issues while providing
 * the same semantic search functionality for course-specific RAG.
 * 
 * Features:
 * - Stores embeddings as JSON arrays in SQLite
 * - Computes cosine similarity in JavaScript for queries
 * - Memory-efficient: SQLite handles large data gracefully
 * - Persistent: survives server restarts
 * - No external dependencies beyond better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Database configuration
const DATA_DIR = process.env.VECTOR_STORE_PATH || path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'vectors.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
let db = null;

/**
 * Get or create database connection
 * @returns {Database}
 */
function getDb() {
  if (!db) {
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL'); // Better performance
    db.pragma('synchronous = NORMAL');
    initializeSchema();
    logger.info(`[VECTOR-STORE] SQLite database initialized at ${DB_FILE}`);
  }
  return db;
}

/**
 * Initialize database schema
 */
function initializeSchema() {
  const database = db || getDb();
  
  // Main embeddings table
  database.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(material_id, chunk_index)
    )
  `);
  
  // Create indexes for fast lookups
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_embeddings_course ON embeddings(course_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_chapter ON embeddings(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_material ON embeddings(material_id);
  `);
  
  logger.debug('[VECTOR-STORE] Schema initialized');
}

/**
 * Compute cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} - Similarity score (0 to 1)
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Add embeddings to the vector store
 * @param {Array<{courseId, chapterId, materialId, chunkIndex, content, embedding, metadata}>} embeddings
 * @returns {number} - Number of embeddings added
 */
function addEmbeddings(embeddings) {
  if (!embeddings || embeddings.length === 0) {
    return 0;
  }
  
  const database = getDb();
  
  const insert = database.prepare(`
    INSERT OR REPLACE INTO embeddings 
    (course_id, chapter_id, material_id, chunk_index, content, embedding, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = database.transaction((items) => {
    let count = 0;
    for (const item of items) {
      insert.run(
        item.courseId,
        item.chapterId,
        item.materialId,
        item.chunkIndex,
        item.content,
        JSON.stringify(item.embedding),
        JSON.stringify(item.metadata || {})
      );
      count++;
    }
    return count;
  });
  
  const added = insertMany(embeddings);
  logger.debug(`[VECTOR-STORE] Added ${added} embeddings`);
  return added;
}

/**
 * Query similar content using cosine similarity
 * @param {string} courseId - Course to search in
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {number} limit - Maximum results
 * @param {Object} filters - Optional filters {chapterId, materialId}
 * @returns {Array<{content, similarity, metadata, chapterId, materialId}>}
 */
function querySimilar(courseId, queryEmbedding, limit = 5, filters = {}) {
  const database = getDb();
  
  // Build query with optional filters
  let sql = 'SELECT * FROM embeddings WHERE course_id = ?';
  const params = [courseId];
  
  if (filters.chapterId) {
    sql += ' AND chapter_id = ?';
    params.push(filters.chapterId);
  }
  
  if (filters.materialId) {
    sql += ' AND material_id = ?';
    params.push(filters.materialId);
  }
  
  const stmt = database.prepare(sql);
  const rows = stmt.all(...params);
  
  if (rows.length === 0) {
    logger.debug(`[VECTOR-STORE] No embeddings found for course ${courseId}`);
    return [];
  }
  
  // Calculate similarity for each row
  const results = rows.map(row => {
    const embedding = JSON.parse(row.embedding);
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    
    return {
      content: row.content,
      similarity,
      metadata: JSON.parse(row.metadata || '{}'),
      chapterId: row.chapter_id,
      materialId: row.material_id,
      chunkIndex: row.chunk_index,
    };
  });
  
  // Sort by similarity (descending) and take top N
  results.sort((a, b) => b.similarity - a.similarity);
  const topResults = results.slice(0, limit);
  
  logger.debug(`[VECTOR-STORE] Found ${topResults.length} similar chunks (top similarity: ${topResults[0]?.similarity.toFixed(3)})`);
  
  return topResults;
}

/**
 * Delete embeddings by material ID
 * @param {string} materialId
 * @returns {number} - Number of rows deleted
 */
function deleteByMaterial(materialId) {
  const database = getDb();
  const result = database.prepare('DELETE FROM embeddings WHERE material_id = ?').run(materialId);
  logger.debug(`[VECTOR-STORE] Deleted ${result.changes} embeddings for material ${materialId}`);
  return result.changes;
}

/**
 * Delete embeddings by chapter ID
 * @param {string} chapterId
 * @returns {number}
 */
function deleteByChapter(chapterId) {
  const database = getDb();
  const result = database.prepare('DELETE FROM embeddings WHERE chapter_id = ?').run(chapterId);
  logger.debug(`[VECTOR-STORE] Deleted ${result.changes} embeddings for chapter ${chapterId}`);
  return result.changes;
}

/**
 * Delete embeddings by course ID
 * @param {string} courseId
 * @returns {number}
 */
function deleteByCourse(courseId) {
  const database = getDb();
  const result = database.prepare('DELETE FROM embeddings WHERE course_id = ?').run(courseId);
  logger.debug(`[VECTOR-STORE] Deleted ${result.changes} embeddings for course ${courseId}`);
  return result.changes;
}

/**
 * Check if a course has any embeddings
 * @param {string} courseId
 * @returns {boolean}
 */
function hasCourseEmbeddings(courseId) {
  const database = getDb();
  const row = database.prepare('SELECT 1 FROM embeddings WHERE course_id = ? LIMIT 1').get(courseId);
  return !!row;
}

/**
 * Get statistics about the vector store
 * @returns {Object}
 */
function getStats() {
  const database = getDb();
  
  const totalEmbeddings = database.prepare('SELECT COUNT(*) as count FROM embeddings').get();
  const courseCount = database.prepare('SELECT COUNT(DISTINCT course_id) as count FROM embeddings').get();
  const chapterCount = database.prepare('SELECT COUNT(DISTINCT chapter_id) as count FROM embeddings').get();
  const materialCount = database.prepare('SELECT COUNT(DISTINCT material_id) as count FROM embeddings').get();
  
  return {
    totalEmbeddings: totalEmbeddings.count,
    courses: courseCount.count,
    chapters: chapterCount.count,
    materials: materialCount.count,
    dbPath: DB_FILE,
  };
}

/**
 * Close the database connection
 */
function close() {
  if (db) {
    db.close();
    db = null;
    logger.info('[VECTOR-STORE] Database connection closed');
  }
}

// Handle process exit
process.on('exit', close);
process.on('SIGINT', () => {
  close();
  process.exit(0);
});

module.exports = {
  addEmbeddings,
  querySimilar,
  deleteByMaterial,
  deleteByChapter,
  deleteByCourse,
  hasCourseEmbeddings,
  getStats,
  close,
  getDb,
};
