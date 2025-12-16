/**
 * Chapter Service
 * Business logic for chapter management
 */

const ChapterModel = require('../models/chapter.model');
const MaterialModel = require('../models/material.model');
const CourseModel = require('../models/course.model');
const logger = require('../config/logger');

/**
 * Create a new chapter
 * @param {string} courseId
 * @param {string} userId
 * @param {Object} chapterData
 * @returns {Promise<Object>}
 */
async function createChapter(courseId, userId, { title, description }) {
  // Verify course ownership
  const course = await CourseModel.findByIdAndUser(courseId, userId);
  if (!course) {
    const error = new Error('Course not found');
    error.statusCode = 404;
    throw error;
  }
  
  const chapter = await ChapterModel.create({
    courseId,
    title,
    description,
  });
  
  logger.info(`Chapter created: ${chapter.id} in course ${courseId}`);
  
  return chapter;
}

/**
 * Get chapter by ID with ownership check
 * @param {string} chapterId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getChapter(chapterId, userId) {
  const chapter = await ChapterModel.findByIdWithCourse(chapterId);
  
  if (!chapter) {
    const error = new Error('Chapter not found');
    error.statusCode = 404;
    throw error;
  }
  
  if (chapter.course.userId !== userId) {
    const error = new Error('Chapter not found');
    error.statusCode = 404;
    throw error;
  }
  
  return chapter;
}

/**
 * Get chapter with materials and navigation
 * @param {string} chapterId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getChapterWithDetails(chapterId, userId) {
  const chapter = await getChapter(chapterId, userId);
  
  const [materials, navigation] = await Promise.all([
    MaterialModel.findByChapter(chapterId),
    ChapterModel.getNavigation(chapterId, chapter.courseId),
  ]);
  
  return {
    ...chapter,
    materials,
    navigation,
  };
}

/**
 * List chapters for a course
 * @param {string} courseId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function listChapters(courseId, userId) {
  // Verify course ownership
  const course = await CourseModel.findByIdAndUser(courseId, userId);
  if (!course) {
    const error = new Error('Course not found');
    error.statusCode = 404;
    throw error;
  }
  
  return ChapterModel.findByCourse(courseId);
}

/**
 * Update a chapter
 * @param {string} chapterId
 * @param {string} userId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateChapter(chapterId, userId, { title, description }) {
  // Verify ownership
  await getChapter(chapterId, userId);
  
  const chapter = await ChapterModel.update(chapterId, {
    title,
    description,
  });
  
  logger.info(`Chapter updated: ${chapterId}`);
  
  return chapter;
}

/**
 * Mark chapter as completed
 * @param {string} chapterId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function markChapterCompleted(chapterId, userId) {
  // Verify ownership
  const chapter = await getChapter(chapterId, userId);
  
  if (chapter.status !== 'ready') {
    const error = new Error('Chapter must be in ready status to mark as completed');
    error.statusCode = 400;
    throw error;
  }
  
  const updated = await ChapterModel.update(chapterId, {
    status: 'completed',
    completedAt: new Date(),
  });
  
  logger.info(`Chapter marked completed: ${chapterId}`);
  
  return updated;
}

/**
 * Reorder chapters in a course
 * @param {string} courseId
 * @param {string} userId
 * @param {Array<{id: string, orderIndex: number}>} orders
 * @returns {Promise<Array>}
 */
async function reorderChapters(courseId, userId, orders) {
  // Verify course ownership
  const course = await CourseModel.findByIdAndUser(courseId, userId);
  if (!course) {
    const error = new Error('Course not found');
    error.statusCode = 404;
    throw error;
  }
  
  await ChapterModel.reorder(courseId, orders);
  
  logger.info(`Chapters reordered in course: ${courseId}`);
  
  return ChapterModel.findByCourse(courseId);
}

/**
 * Delete a chapter
 * @param {string} chapterId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteChapter(chapterId, userId) {
  // Verify ownership
  await getChapter(chapterId, userId);
  
  // Note: CASCADE will delete materials
  await ChapterModel.remove(chapterId);
  
  logger.info(`Chapter deleted: ${chapterId}`);
}

/**
 * Update chapter status based on materials processing
 * @param {string} chapterId
 * @returns {Promise<void>}
 */
async function updateChapterStatusFromMaterials(chapterId) {
  const materials = await MaterialModel.findByChapter(chapterId);
  
  if (materials.length === 0) {
    await ChapterModel.updateStatus(chapterId, 'draft');
    return;
  }
  
  const allCompleted = materials.every(m => m.status === 'completed');
  const anyProcessing = materials.some(m => m.status === 'processing');
  const anyPending = materials.some(m => m.status === 'pending');
  
  if (allCompleted) {
    await ChapterModel.updateStatus(chapterId, 'ready');
  } else if (anyProcessing || anyPending) {
    await ChapterModel.updateStatus(chapterId, 'processing');
  }
}

module.exports = {
  createChapter,
  getChapter,
  getChapterWithDetails,
  listChapters,
  updateChapter,
  markChapterCompleted,
  reorderChapters,
  deleteChapter,
  updateChapterStatusFromMaterials,
};
