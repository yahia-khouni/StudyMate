/**
 * Course Validation Middleware
 * Validate course-related requests
 */

/**
 * Validate create course request
 */
function validateCreateCourse(req, res, next) {
  const { title, language } = req.body;
  const errors = [];
  
  if (!title || typeof title !== 'string') {
    errors.push('Title is required and must be a string');
  } else if (title.trim().length < 3) {
    errors.push('Title must be at least 3 characters');
  } else if (title.trim().length > 255) {
    errors.push('Title must be less than 255 characters');
  }
  
  if (language && !['en', 'tr'].includes(language)) {
    errors.push('Language must be "en" or "tr"');
  }
  
  if (req.body.description && typeof req.body.description !== 'string') {
    errors.push('Description must be a string');
  }
  
  if (req.body.syllabus && typeof req.body.syllabus !== 'string') {
    errors.push('Syllabus must be a string');
  }
  
  if (req.body.color) {
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!colorRegex.test(req.body.color)) {
      errors.push('Color must be a valid hex color (e.g., #FF5733)');
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
  if (req.body.syllabus) {
    req.body.syllabus = req.body.syllabus.trim();
  }
  
  next();
}

/**
 * Validate update course request
 */
function validateUpdateCourse(req, res, next) {
  const { title, language, description, syllabus, color } = req.body;
  const errors = [];
  
  if (title !== undefined) {
    if (typeof title !== 'string') {
      errors.push('Title must be a string');
    } else if (title.trim().length < 3) {
      errors.push('Title must be at least 3 characters');
    } else if (title.trim().length > 255) {
      errors.push('Title must be less than 255 characters');
    }
  }
  
  if (language !== undefined && !['en', 'tr'].includes(language)) {
    errors.push('Language must be "en" or "tr"');
  }
  
  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }
  
  if (syllabus !== undefined && typeof syllabus !== 'string') {
    errors.push('Syllabus must be a string');
  }
  
  if (color !== undefined) {
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!colorRegex.test(color)) {
      errors.push('Color must be a valid hex color (e.g., #FF5733)');
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
  if (syllabus) req.body.syllabus = syllabus.trim();
  
  next();
}

/**
 * Validate course ID parameter
 */
function validateCourseId(req, res, next) {
  const { courseId } = req.params;
  
  // IDs are UUIDs (strings)
  if (!courseId || typeof courseId !== 'string' || courseId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid course ID',
    });
  }
  
  next();
}

module.exports = {
  validateCreateCourse,
  validateUpdateCourse,
  validateCourseId,
};
