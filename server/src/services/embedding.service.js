/**
 * Embedding Service
 * Memory-efficient implementation using SQLite vector store
 * 
 * Key features:
 * - Local hash-based embeddings (no external API)
 * - SQLite storage (no ChromaDB dependency)  
 * - Simple, clean implementation to avoid memory issues
 */

const vectorStore = require('./vector-store.service');
const logger = require('../config/logger');

// Configuration
const MAX_CHUNKS = parseInt(process.env.MAX_EMBEDDING_CHUNKS || '20', 10);
const SKIP_EMBEDDINGS = process.env.SKIP_EMBEDDINGS === 'true';
const EMBEDDING_DIM = 384;

// Chunking settings
const CHUNK_SIZE = 2000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

/**
 * Split text into chunks
 */
function chunkText(text) {
  if (!text || text.length === 0) return [];
  
  const chunks = [];
  let start = 0;
  let index = 0;
  
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('. ', end);
      if (lastPeriod > start + CHUNK_SIZE / 2) {
        end = lastPeriod + 2;
      }
    }
    
    const chunkContent = text.slice(start, end).trim();
    if (chunkContent.length > 0) {
      chunks.push({ text: chunkContent, index, startChar: start, endChar: end });
      index++;
    }
    
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
    if (start >= text.length - 10) break;
  }
  
  return chunks;
}

/**
 * Generate embedding using hash-based approach
 */
function generateLocalEmbedding(text) {
  const embedding = new Float32Array(EMBEDDING_DIM);
  
  if (!text) return Array.from(embedding);
  
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const weight = 1 / (1 + Math.log1p(i));
    
    // Simple hash
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
    }
    
    const idx = Math.abs(hash) % EMBEDDING_DIM;
    embedding[idx] += weight;
  }
  
  // Normalize
  let mag = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) mag += embedding[i] * embedding[i];
  mag = Math.sqrt(mag) || 1;
  
  const result = new Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) result[i] = embedding[i] / mag;
  
  return result;
}

/**
 * Add document embeddings to vector store
 */
async function addDocumentEmbeddings(courseId, chapterId, materialId, content) {
  if (SKIP_EMBEDDINGS) {
    logger.info('[EMBED] Skipping (SKIP_EMBEDDINGS=true)');
    return { chunksAdded: 0, skipped: true };
  }
  
  if (!content || !content.trim()) {
    return { chunksAdded: 0, skipped: true, error: 'Empty content' };
  }
  
  try {
    logger.info(`[EMBED] Processing ${content.length} chars for material ${materialId}`);
    
    const chunks = chunkText(content).slice(0, MAX_CHUNKS);
    
    if (chunks.length === 0) {
      return { chunksAdded: 0, skipped: true, error: 'No chunks' };
    }
    
    logger.info(`[EMBED] Generating ${chunks.length} embeddings...`);
    
    const embeddings = chunks.map((chunk, i) => ({
      courseId,
      chapterId,
      materialId,
      chunkIndex: i,
      content: chunk.text,
      embedding: generateLocalEmbedding(chunk.text),
      metadata: { startChar: chunk.startChar, endChar: chunk.endChar, totalChunks: chunks.length }
    }));
    
    const added = vectorStore.addEmbeddings(embeddings);
    logger.info(`[EMBED] Stored ${added} embeddings`);
    
    return { chunksAdded: added, skipped: false };
  } catch (error) {
    logger.error('[EMBED] Error:', error.message);
    return { chunksAdded: 0, skipped: false, error: error.message };
  }
}

/**
 * Query similar content
 */
async function querySimilarContent(courseId, query, limit = 5, filters = {}) {
  if (SKIP_EMBEDDINGS) {
    return [];
  }
  
  try {
    const queryEmbedding = generateLocalEmbedding(query);
    const results = vectorStore.querySimilar(courseId, queryEmbedding, limit, filters);
    logger.info(`[QUERY] Found ${results.length} results for course ${courseId}`);
    return results;
  } catch (error) {
    logger.error('[QUERY] Error:', error.message);
    return [];
  }
}

/**
 * Delete embeddings for a material
 */
async function deleteDocumentEmbeddings(materialId) {
  try {
    return vectorStore.deleteByMaterial(materialId);
  } catch (error) {
    logger.error('[EMBED] Delete error:', error.message);
    return 0;
  }
}

/**
 * Delete embeddings for a chapter
 */
async function deleteChapterEmbeddings(courseId, chapterId) {
  try {
    return vectorStore.deleteByChapter(chapterId);
  } catch (error) {
    logger.error('[EMBED] Delete error:', error.message);
    return 0;
  }
}

/**
 * Delete all embeddings for a course
 */
async function deleteCourseEmbeddings(courseId) {
  try {
    return vectorStore.deleteByCourse(courseId);
  } catch (error) {
    logger.error('[EMBED] Delete error:', error.message);
    return 0;
  }
}

/**
 * Check if course has embeddings
 */
async function hasCourseEmbeddings(courseId) {
  return vectorStore.hasCourseEmbeddings(courseId);
}

/**
 * Get statistics
 */
async function getStats() {
  return vectorStore.getStats();
}

/**
 * Verify connection (always returns true for SQLite)
 */
async function verifyConnection() {
  return true; // SQLite is always available locally
}

// Alias functions for convenience
const deleteByMaterial = deleteDocumentEmbeddings;
const deleteByChapter = deleteChapterEmbeddings;
const deleteByCourse = deleteCourseEmbeddings;

module.exports = {
  addDocumentEmbeddings,
  querySimilarContent,
  deleteDocumentEmbeddings,
  deleteChapterEmbeddings,
  deleteCourseEmbeddings,
  deleteByMaterial,
  deleteByChapter,
  deleteByCourse,
  hasCourseEmbeddings,
  getStats,
  verifyConnection,
  generateLocalEmbedding,
  EMBEDDING_DIM,
};
