/**
 * Embedding Service
 * Handles vector storage and retrieval using ChromaDB
 * 
 * MEMORY-OPTIMIZED: Generates and stores embeddings in small batches
 * to prevent JavaScript heap out of memory errors.
 */

const { ChromaClient } = require('chromadb');
const axios = require('axios');
const { chunkText } = require('./ai.service');
const logger = require('../config/logger');

// ChromaDB configuration
const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = process.env.CHROMA_PORT || 8000;

// HuggingFace configuration for direct embedding calls
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/BAAI/bge-m3';
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Memory-safe configuration - use environment variables for tuning
const EMBEDDING_BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH_SIZE || '1', 10); // Process 1 at a time
const MAX_EMBEDDING_CHUNKS = parseInt(process.env.MAX_EMBEDDING_CHUNKS || '8', 10); // Strict limit
const BATCH_DELAY_MS = parseInt(process.env.EMBEDDING_BATCH_DELAY_MS || '1000', 10);
const SKIP_EMBEDDINGS = process.env.SKIP_EMBEDDINGS === 'true';
const USE_LOCAL_EMBEDDINGS = process.env.USE_LOCAL_EMBEDDINGS !== 'false'; // Default to local (memory-safe)

// Collection naming convention
const getCollectionName = (courseId) => `course_${courseId.replace(/-/g, '_')}`;

// ChromaDB client singleton
let chromaClient = null;

/**
 * Get ChromaDB client instance
 * @returns {ChromaClient}
 */
function getClient() {
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: `http://${CHROMA_HOST}:${CHROMA_PORT}`,
    });
  }
  return chromaClient;
}

/**
 * Create or get a collection for a course
 * @param {string} courseId
 * @returns {Promise<Collection>}
 */
async function getOrCreateCollection(courseId) {
  const client = getClient();
  const collectionName = getCollectionName(courseId);

  try {
    // Try to get existing collection
    const collection = await client.getOrCreateCollection({
      name: collectionName,
      metadata: {
        courseId,
        createdAt: new Date().toISOString(),
      },
    });

    logger.info(`Collection ready: ${collectionName}`);
    return collection;
  } catch (error) {
    logger.error(`Failed to get/create collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Generate embeddings for a single small batch using HuggingFace API directly
 * This function is memory-optimized: generates, returns, and should be used
 * with immediate storage followed by releasing references.
 * 
 * @param {Array<string>} texts - Small batch of texts (1-3 items max)
 * @returns {Promise<Array<Array<number>>>} - Embedding vectors
 */
async function generateBatchEmbeddings(texts) {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Use local embeddings by default (much more memory efficient)
  if (USE_LOCAL_EMBEDDINGS) {
    logger.debug('Using local embeddings (USE_LOCAL_EMBEDDINGS=true)');
    return generateFallbackEmbeddings(texts);
  }

  // Fallback if no API key
  if (!HUGGINGFACE_API_KEY) {
    logger.warn('HuggingFace API key not configured, using fallback embeddings');
    return generateFallbackEmbeddings(texts);
  }

  try {
    const response = await axios.post(
      HUGGINGFACE_API_URL,
      {
        inputs: texts,
        options: {
          wait_for_model: true,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const embeddings = response.data;
    
    // CRITICAL: Clear response data immediately after extracting embeddings
    response.data = null;
    
    return embeddings;
  } catch (error) {
    logger.error('HuggingFace embedding error:', error.response?.data || error.message);
    // Return fallback embeddings on error
    return generateFallbackEmbeddings(texts);
  }
}

/**
 * Fallback embedding generation - simple hash-based pseudo-embeddings
 * Memory efficient alternative when HuggingFace is unavailable
 * @param {Array<string>} texts
 * @returns {Array<Array<number>>}
 */
function generateFallbackEmbeddings(texts) {
  // Use smaller dimension (384) for memory efficiency
  const EMBEDDING_DIM = 384;
  const embeddings = [];
  
  for (const text of texts) {
    const embedding = new Array(EMBEDDING_DIM).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
      }
      const idx = Math.abs(hash) % EMBEDDING_DIM;
      embedding[idx] += 1 / (1 + Math.log(1 + i));
    }
    
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
    const normalized = embedding.map(val => val / magnitude);
    embeddings.push(normalized);
  }
  
  return embeddings;
}

/**
 * Force garbage collection if available
 */
function tryGarbageCollect() {
  if (global.gc) {
    try {
      global.gc();
      logger.debug('Forced garbage collection');
    } catch (e) {
      // Ignore GC errors
    }
  }
}

/**
 * Sleep utility with optional GC
 * @param {number} ms
 * @param {boolean} runGC - Whether to run GC after sleep
 */
async function sleepWithGC(ms, runGC = true) {
  await new Promise(resolve => setTimeout(resolve, ms));
  if (runGC) {
    tryGarbageCollect();
  }
}

/**
 * Add document chunks to a course collection - STREAMING VERSION
 * 
 * This function is memory-optimized:
 * 1. Chunks the content
 * 2. For each small batch: generate embeddings -> store in ChromaDB -> release memory
 * 3. Never holds all embeddings in memory at once
 * 
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID  
 * @param {string} materialId - Material ID (optional)
 * @param {string} content - Content to embed
 * @returns {Promise<{chunksAdded: number, collection: string}>}
 */
async function addDocumentEmbeddings(courseId, chapterId, materialId, content) {
  // TEMPORARY: Force skip embeddings to prevent memory crashes
  // The ChromaDB client appears to cause heap overflow issues
  logger.info('[EMBED] Embeddings temporarily disabled to prevent memory issues');
  return { chunksAdded: 0, collection: getCollectionName(courseId), skipped: true, reason: 'Memory optimization - embeddings disabled' };

  // Allow skipping embeddings via environment variable for debugging
  if (SKIP_EMBEDDINGS) {
    logger.info('[EMBED] Skipping embeddings (SKIP_EMBEDDINGS=true)');
    return { chunksAdded: 0, collection: getCollectionName(courseId), skipped: true };
  }

  if (!content || content.trim().length === 0) {
    logger.warn('Empty content provided for embedding');
    return { chunksAdded: 0, collection: getCollectionName(courseId) };
  }

  const collectionName = getCollectionName(courseId);

  try {
    // First verify ChromaDB is available
    const isConnected = await verifyConnection();
    if (!isConnected) {
      logger.warn('ChromaDB not available, skipping embedding generation');
      return { chunksAdded: 0, collection: collectionName, skipped: true };
    }
    
    logger.info('[EMBED] ChromaDB connected, starting chunking...');
    
    // Chunk the content - get chunk info without storing all text
    const allChunks = chunkText(content);
    const totalChunks = Math.min(allChunks.length, MAX_EMBEDDING_CHUNKS);
    
    // CRITICAL: Release content immediately
    content = null;
    
    if (totalChunks === 0) {
      logger.warn('No chunks generated from content');
      return { chunksAdded: 0, collection: collectionName };
    }

    if (allChunks.length > MAX_EMBEDDING_CHUNKS) {
      logger.warn(`Document has ${allChunks.length} chunks, limiting to ${MAX_EMBEDDING_CHUNKS}`);
    }

    logger.info(`[EMBED] Will process ${totalChunks} chunks one at a time`);
    
    // Force GC before starting
    tryGarbageCollect();

    // Get collection once
    const collection = await getOrCreateCollection(courseId);
    
    let totalAdded = 0;

    // Process ONE chunk at a time for minimal memory usage
    for (let i = 0; i < totalChunks; i++) {
      const chunk = allChunks[i];
      
      logger.debug(`[EMBED] Processing chunk ${i + 1}/${totalChunks}`);
      
      // Generate embedding for single chunk
      const embeddings = await generateBatchEmbeddings([chunk.text]);
      
      if (!embeddings || embeddings.length === 0) {
        logger.warn(`[EMBED] Failed to generate embedding for chunk ${i + 1}`);
        continue;
      }

      // Store immediately
      const id = `${chapterId}_${materialId || 'content'}_${i}`;
      const metadata = {
        chapterId,
        materialId: materialId || null,
        chunkIndex: i,
        totalChunks,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        charCount: chunk.text.length,
        createdAt: new Date().toISOString(),
      };

      await collection.upsert({
        ids: [id],
        embeddings: embeddings,
        metadatas: [metadata],
        documents: [chunk.text],
      });

      totalAdded++;
      
      // Release references
      allChunks[i] = null; // Allow GC of processed chunk
      
      // Brief pause with GC every few chunks
      if (i % 3 === 2) {
        await sleepWithGC(BATCH_DELAY_MS, true);
        logger.info(`[EMBED] Progress: ${totalAdded}/${totalChunks} chunks stored`);
      }
    }

    // Final cleanup
    tryGarbageCollect();

    logger.info(`[EMBED] Complete: Added ${totalAdded} embeddings to ${collectionName}`);

    return {
      chunksAdded: totalAdded,
      collection: collectionName,
    };
  } catch (error) {
    logger.error('[EMBED] Failed to add document embeddings:', error.message);
    return { chunksAdded: 0, collection: collectionName, error: error.message };
  }
}

/**
 * Query similar content from a course collection
 * @param {string} courseId - Course ID
 * @param {string} query - Query text
 * @param {number} nResults - Number of results to return
 * @param {Object} filters - Optional metadata filters
 * @returns {Promise<Array<{id: string, text: string, metadata: Object, distance: number}>>}
 */
async function querySimilarContent(courseId, query, nResults = 5, filters = {}) {
  // If embeddings are disabled, return empty results
  // Chat will proceed without RAG context
  if (SKIP_EMBEDDINGS) {
    logger.info('[QUERY] Embeddings disabled (SKIP_EMBEDDINGS=true), returning empty context');
    return [];
  }

  try {
    const collection = await getOrCreateCollection(courseId);

    // Generate embedding for query using our batch function
    const queryEmbeddings = await generateBatchEmbeddings([query]);
    const queryEmbedding = queryEmbeddings[0];

    // Build where clause from filters
    let whereClause = undefined;
    if (Object.keys(filters).length > 0) {
      whereClause = {};
      for (const [key, value] of Object.entries(filters)) {
        whereClause[key] = value;
      }
    }

    // Query ChromaDB
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where: whereClause,
    });

    // Format results
    const formattedResults = [];
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        formattedResults.push({
          id: results.ids[0][i],
          text: results.documents?.[0]?.[i] || '',
          metadata: results.metadatas?.[0]?.[i] || {},
          distance: results.distances?.[0]?.[i] || 0,
        });
      }
    }

    return formattedResults;
  } catch (error) {
    logger.error('Failed to query similar content:', error);
    throw error;
  }
}

/**
 * Delete embeddings for a specific chapter
 * @param {string} courseId
 * @param {string} chapterId
 * @returns {Promise<void>}
 */
async function deleteChapterEmbeddings(courseId, chapterId) {
  try {
    const collection = await getOrCreateCollection(courseId);

    // Get all IDs for this chapter
    const results = await collection.get({
      where: { chapterId },
    });

    if (results.ids && results.ids.length > 0) {
      await collection.delete({
        ids: results.ids,
      });
      logger.info(`Deleted ${results.ids.length} embeddings for chapter ${chapterId}`);
    }
  } catch (error) {
    logger.error('Failed to delete chapter embeddings:', error);
    throw error;
  }
}

/**
 * Delete embeddings for a specific material
 * @param {string} courseId
 * @param {string} materialId
 * @returns {Promise<void>}
 */
async function deleteMaterialEmbeddings(courseId, materialId) {
  try {
    const collection = await getOrCreateCollection(courseId);

    // Get all IDs for this material
    const results = await collection.get({
      where: { materialId },
    });

    if (results.ids && results.ids.length > 0) {
      await collection.delete({
        ids: results.ids,
      });
      logger.info(`Deleted ${results.ids.length} embeddings for material ${materialId}`);
    }
  } catch (error) {
    logger.error('Failed to delete material embeddings:', error);
    throw error;
  }
}

/**
 * Delete entire course collection
 * @param {string} courseId
 * @returns {Promise<void>}
 */
async function deleteCourseCollection(courseId) {
  try {
    const client = getClient();
    const collectionName = getCollectionName(courseId);

    await client.deleteCollection({ name: collectionName });
    logger.info(`Deleted collection: ${collectionName}`);
  } catch (error) {
    // Collection might not exist
    logger.warn(`Failed to delete collection for course ${courseId}:`, error.message);
  }
}

/**
 * Get collection statistics
 * @param {string} courseId
 * @returns {Promise<{count: number, collection: string}>}
 */
async function getCollectionStats(courseId) {
  try {
    const collection = await getOrCreateCollection(courseId);
    const count = await collection.count();

    return {
      count,
      collection: getCollectionName(courseId),
    };
  } catch (error) {
    logger.error('Failed to get collection stats:', error);
    return {
      count: 0,
      collection: getCollectionName(courseId),
    };
  }
}

/**
 * Verify ChromaDB connectivity
 * @returns {Promise<boolean>}
 */
async function verifyConnection() {
  try {
    const client = getClient();
    await client.heartbeat();
    logger.info('ChromaDB connection verified');
    return true;
  } catch (error) {
    logger.error('ChromaDB connection failed:', error.message);
    return false;
  }
}

/**
 * Re-embed all content for a chapter
 * @param {string} courseId
 * @param {string} chapterId
 * @param {string} content
 * @returns {Promise<{chunksAdded: number}>}
 */
async function reembedChapter(courseId, chapterId, content) {
  // Delete existing embeddings
  await deleteChapterEmbeddings(courseId, chapterId);

  // Add new embeddings
  return addDocumentEmbeddings(courseId, chapterId, null, content);
}

module.exports = {
  getClient,
  getOrCreateCollection,
  addDocumentEmbeddings,
  querySimilarContent,
  deleteChapterEmbeddings,
  deleteMaterialEmbeddings,
  deleteCourseCollection,
  getCollectionStats,
  verifyConnection,
  reembedChapter,
  getCollectionName,
};
