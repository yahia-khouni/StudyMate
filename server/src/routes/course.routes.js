/**
 * Course Routes
 * API endpoints for course and chapter management
 */

const express = require('express');
const router = express.Router();

// Controllers
const courseController = require('../controllers/course.controller');
const chapterController = require('../controllers/chapter.controller');
const materialController = require('../controllers/material.controller');

// Middleware
const { authenticate } = require('../middleware/auth');
const { validateCreateCourse, validateUpdateCourse, validateCourseId } = require('../middleware/course.validation');
const { validateCreateChapter, validateUpdateChapter, validateChapterId, validateReorderChapters } = require('../middleware/chapter.validation');
const { validateMaterialId, handleUploadError } = require('../middleware/material.validation');
const { uploadSingle } = require('../services/upload.service');

// All routes require authentication
router.use(authenticate);

// ============ COURSE ROUTES ============

/**
 * @route   GET /api/courses
 * @desc    Get all courses for authenticated user
 * @access  Private
 */
router.get('/', courseController.getUserCourses);

/**
 * @route   POST /api/courses
 * @desc    Create a new course
 * @access  Private
 */
router.post('/', validateCreateCourse, courseController.createCourse);

/**
 * @route   GET /api/courses/:courseId
 * @desc    Get a specific course
 * @access  Private
 */
router.get('/:courseId', validateCourseId, courseController.getCourse);

/**
 * @route   GET /api/courses/:courseId/progress
 * @desc    Get course with progress statistics
 * @access  Private
 */
router.get('/:courseId/progress', validateCourseId, courseController.getCourseWithProgress);

/**
 * @route   PUT /api/courses/:courseId
 * @desc    Update a course
 * @access  Private
 */
router.put('/:courseId', validateCourseId, validateUpdateCourse, courseController.updateCourse);

/**
 * @route   DELETE /api/courses/:courseId
 * @desc    Delete a course
 * @access  Private
 */
router.delete('/:courseId', validateCourseId, courseController.deleteCourse);

// ============ CHAPTER ROUTES ============

/**
 * @route   GET /api/courses/:courseId/chapters
 * @desc    Get all chapters for a course
 * @access  Private
 */
router.get('/:courseId/chapters', validateCourseId, chapterController.getCourseChapters);

/**
 * @route   POST /api/courses/:courseId/chapters
 * @desc    Create a new chapter in a course
 * @access  Private
 */
router.post('/:courseId/chapters', validateCourseId, validateCreateChapter, chapterController.createChapter);

/**
 * @route   PUT /api/courses/:courseId/chapters/reorder
 * @desc    Reorder chapters in a course
 * @access  Private
 */
router.put('/:courseId/chapters/reorder', validateCourseId, validateReorderChapters, chapterController.reorderChapters);

/**
 * @route   GET /api/courses/:courseId/chapters/:chapterId
 * @desc    Get a specific chapter
 * @access  Private
 */
router.get('/:courseId/chapters/:chapterId', validateCourseId, validateChapterId, chapterController.getChapter);

/**
 * @route   PUT /api/courses/:courseId/chapters/:chapterId
 * @desc    Update a chapter
 * @access  Private
 */
router.put('/:courseId/chapters/:chapterId', validateCourseId, validateChapterId, validateUpdateChapter, chapterController.updateChapter);

/**
 * @route   DELETE /api/courses/:courseId/chapters/:chapterId
 * @desc    Delete a chapter
 * @access  Private
 */
router.delete('/:courseId/chapters/:chapterId', validateCourseId, validateChapterId, chapterController.deleteChapter);

/**
 * @route   POST /api/courses/:courseId/chapters/:chapterId/complete
 * @desc    Mark a chapter as complete
 * @access  Private
 */
router.post('/:courseId/chapters/:chapterId/complete', validateCourseId, validateChapterId, chapterController.markChapterComplete);

// ============ MATERIAL ROUTES ============

/**
 * @route   GET /api/courses/:courseId/chapters/:chapterId/materials
 * @desc    Get all materials for a chapter
 * @access  Private
 */
router.get('/:courseId/chapters/:chapterId/materials', validateCourseId, validateChapterId, materialController.getChapterMaterials);

/**
 * @route   POST /api/courses/:courseId/chapters/:chapterId/materials
 * @desc    Upload a material to a chapter
 * @access  Private
 */
router.post(
  '/:courseId/chapters/:chapterId/materials',
  validateCourseId,
  validateChapterId,
  uploadSingle,
  handleUploadError,
  materialController.uploadMaterial
);

/**
 * @route   GET /api/courses/:courseId/chapters/:chapterId/materials/:materialId
 * @desc    Get a specific material
 * @access  Private
 */
router.get('/:courseId/chapters/:chapterId/materials/:materialId', validateCourseId, validateChapterId, validateMaterialId, materialController.getMaterial);

/**
 * @route   GET /api/courses/:courseId/chapters/:chapterId/materials/:materialId/status
 * @desc    Get processing status for a material
 * @access  Private
 */
router.get('/:courseId/chapters/:chapterId/materials/:materialId/status', validateCourseId, validateChapterId, validateMaterialId, materialController.getMaterialStatus);

/**
 * @route   POST /api/courses/:courseId/chapters/:chapterId/materials/:materialId/process
 * @desc    Start synchronous processing for a material (blocking)
 * @access  Private
 */
router.post('/:courseId/chapters/:chapterId/materials/:materialId/process', validateCourseId, validateChapterId, validateMaterialId, materialController.processMaterial);

/**
 * @route   POST /api/courses/:courseId/chapters/:chapterId/materials/:materialId/reset
 * @desc    Reset a material to pending status (allows reprocessing)
 * @access  Private
 */
router.post('/:courseId/chapters/:chapterId/materials/:materialId/reset', validateCourseId, validateChapterId, validateMaterialId, materialController.resetMaterial);

/**
 * @route   GET /api/courses/:courseId/chapters/:chapterId/materials/:materialId/result
 * @desc    Get detailed processing result for a material
 * @access  Private
 */
router.get('/:courseId/chapters/:chapterId/materials/:materialId/result', validateCourseId, validateChapterId, validateMaterialId, materialController.getProcessingResult);

/**
 * @route   DELETE /api/courses/:courseId/chapters/:chapterId/materials/:materialId
 * @desc    Delete a material
 * @access  Private
 */
router.delete('/:courseId/chapters/:chapterId/materials/:materialId', validateCourseId, validateChapterId, validateMaterialId, materialController.deleteMaterial);

module.exports = router;
