/**
 * Chapter Validation Middleware
 * Validate chapter-related requests
 */

/**
 * Validate create chapter request
 */
function validateCreateChapter(req, res, next) {
  const { title } = req.body;
  const errors = [];
  
  if (!title || typeof title !== 'string') {
    errors.push('Title is required and must be a string');
  } else if (title.trim().length < 1) {
    errors.push('Title cannot be empty');
  } else if (title.trim().length > 255) {
    errors.push('Title must be less than 255 characters');
  }
  
  if (req.body.description && typeof req.body.description !== 'string') {
    errors.push('Description must be a string');
  }
  
  if (req.body.order_index !== undefined) {
    if (typeof req.body.order_index !== 'number' || req.body.order_index < 0) {
      errors.push('Order index must be a non-negative number');
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }
  
  // Sanitize input
  req.body.title = title.trim();
  if (req.body.description) {
    req.body.description = req.body.description.trim();
  }
  
  next();
}

/**
 * Validate update chapter request
 */
function validateUpdateChapter(req, res, next) {
  const { title, description, status } = req.body;
  const errors = [];
  
  if (title !== undefined) {
    if (typeof title !== 'string') {
      errors.push('Title must be a string');
    } else if (title.trim().length < 1) {
      errors.push('Title cannot be empty');
    } else if (title.trim().length > 255) {
      errors.push('Title must be less than 255 characters');
    }
  }
  
  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }
  
  if (status !== undefined) {
    const validStatuses = ['draft', 'processing', 'ready', 'completed'];
    if (!validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }
  
  // Sanitize input
  if (title) req.body.title = title.trim();
  if (description) req.body.description = description.trim();
  
  next();
}

/**
 * Validate chapter ID parameter
 */
function validateChapterId(req, res, next) {
  const { chapterId } = req.params;
  
  // IDs are UUIDs (strings)
  if (!chapterId || typeof chapterId !== 'string' || chapterId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid chapter ID',
    });
  }
  
  next();
}

/**
 * Validate reorder chapters request
 */
function validateReorderChapters(req, res, next) {
  const { chapterIds } = req.body;
  
  if (!chapterIds || !Array.isArray(chapterIds)) {
    return res.status(400).json({
      success: false,
      error: 'chapterIds must be an array',
    });
  }
  
  if (chapterIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'chapterIds cannot be empty',
    });
  }
  
  // Validate each ID is a non-empty string (UUIDs)
  for (const id of chapterIds) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'All chapter IDs must be valid strings',
      });
    }
  }
  
  // Check for duplicates
  const uniqueIds = new Set(chapterIds);
  if (uniqueIds.size !== chapterIds.length) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate chapter IDs not allowed',
    });
  }
  
  next();
}

module.exports = {
  validateCreateChapter,
  validateUpdateChapter,
  validateChapterId,
  validateReorderChapters,
};
