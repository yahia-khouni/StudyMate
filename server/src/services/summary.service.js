/**
 * Summary Service
 * Business logic for chapter summaries
 */

const SummaryModel = require('../models/summary.model');
const ChapterModel = require('../models/chapter.model');
const MaterialModel = require('../models/material.model');
const aiService = require('./ai.service');
const logger = require('../config/logger');

/**
 * Get summary for a chapter
 * @param {string} chapterId
 * @param {string} language
 * @returns {Promise<Object|null>}
 */
async function getSummary(chapterId, language) {
  return SummaryModel.findByChapterAndLanguage(chapterId, language);
}

/**
 * Get all summaries for a chapter
 * @param {string} chapterId
 * @returns {Promise<Array>}
 */
async function getChapterSummaries(chapterId) {
  return SummaryModel.findByChapter(chapterId);
}

/**
 * Get all summaries for a course
 * @param {string} courseId
 * @returns {Promise<Array>}
 */
async function getCourseSummaries(courseId) {
  return SummaryModel.findByCourse(courseId);
}

/**
 * Generate and save a summary for a chapter
 * @param {string} chapterId
 * @param {string} userId - User requesting the summary (for authorization)
 * @param {string} language - Optional language override
 * @returns {Promise<Object>}
 */
async function generateSummary(chapterId, userId, language = null) {
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
  // Prefer structuredContent, fall back to extractedText
  const contentParts = completedMaterials.map(m => {
    const content = m.structuredContent || m.extractedText;
    return content ? `## ${m.originalFilename}\n\n${content}` : '';
  }).filter(Boolean);
  
  if (contentParts.length === 0) {
    throw new Error('No content available from processed materials.');
  }
  
  const combinedContent = contentParts.join('\n\n---\n\n');
  
  // Use chapter's course language if not specified
  const targetLanguage = language || chapter.course.language || 'en';
  
  logger.info(`Generating summary for chapter ${chapterId} in ${targetLanguage} from ${completedMaterials.length} materials`);
  
  try {
    // Generate summary using AI
    const summaryContent = await aiService.generateSummary(
      combinedContent,
      targetLanguage
    );
    
    // Save to database (creates or updates)
    const summary = await SummaryModel.create({
      chapterId,
      language: targetLanguage,
      content: summaryContent,
    });
    
    logger.info(`Summary created for chapter ${chapterId}: ${summary.id}`);
    
    return summary;
  } catch (error) {
    logger.error(`Failed to generate summary for chapter ${chapterId}:`, error.message);
    throw error;
  }
}

/**
 * Regenerate a summary
 * @param {string} summaryId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function regenerateSummary(summaryId, userId) {
  const summary = await SummaryModel.findById(summaryId);
  
  if (!summary) {
    throw new Error('Summary not found');
  }
  
  // Re-generate for the same chapter and language
  return generateSummary(summary.chapterId, userId, summary.language);
}

/**
 * Delete a summary
 * @param {string} summaryId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function deleteSummary(summaryId, userId) {
  const summary = await SummaryModel.findById(summaryId);
  
  if (!summary) {
    throw new Error('Summary not found');
  }
  
  // Verify user owns the chapter's course
  const chapter = await ChapterModel.findByIdWithCourse(summary.chapterId);
  if (!chapter || chapter.course.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return SummaryModel.remove(summaryId);
}

module.exports = {
  getSummary,
  getChapterSummaries,
  getCourseSummaries,
  generateSummary,
  regenerateSummary,
  deleteSummary,
};
