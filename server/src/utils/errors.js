/**
 * Custom Error Classes and Error Handling Utilities
 * Standardized error responses for the API
 */

/**
 * Base Application Error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error - 400
 */
class ValidationError extends AppError {
  constructor(message, fields = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

/**
 * Authentication Error - 401
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization Error - 403
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not Found Error - 404
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.resource = resource;
  }
}

/**
 * Conflict Error - 409
 */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Rate Limit Error - 429
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT');
  }
}

/**
 * External Service Error - 502
 */
class ExternalServiceError extends AppError {
  constructor(service = 'External service', message = 'Service unavailable') {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

/**
 * Error Codes for i18n
 */
const ERROR_CODES = {
  // Authentication
  INVALID_CREDENTIALS: 'auth.invalidCredentials',
  TOKEN_EXPIRED: 'auth.tokenExpired',
  TOKEN_INVALID: 'auth.tokenInvalid',
  EMAIL_NOT_VERIFIED: 'auth.emailNotVerified',
  EMAIL_ALREADY_EXISTS: 'auth.emailAlreadyExists',
  
  // Validation
  VALIDATION_ERROR: 'validation.error',
  INVALID_INPUT: 'validation.invalidInput',
  REQUIRED_FIELD: 'validation.requiredField',
  
  // Resources
  NOT_FOUND: 'error.notFound',
  COURSE_NOT_FOUND: 'error.courseNotFound',
  CHAPTER_NOT_FOUND: 'error.chapterNotFound',
  QUIZ_NOT_FOUND: 'error.quizNotFound',
  
  // Operations
  OPERATION_FAILED: 'error.operationFailed',
  FILE_UPLOAD_FAILED: 'error.fileUploadFailed',
  AI_SERVICE_ERROR: 'error.aiServiceError',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'error.rateLimitExceeded',
  
  // Generic
  INTERNAL_ERROR: 'error.internalError',
  SERVICE_UNAVAILABLE: 'error.serviceUnavailable',
};

/**
 * Format error response for API
 * @param {Error} error - Error object
 * @param {boolean} includeStack - Include stack trace (development only)
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(error, includeStack = false) {
  const response = {
    success: false,
    error: {
      message: error.message || 'An unexpected error occurred',
      code: error.code || 'INTERNAL_ERROR',
    },
  };

  // Add validation fields if present
  if (error.fields) {
    response.error.fields = error.fields;
  }

  // Add resource name if present
  if (error.resource) {
    response.error.resource = error.resource;
  }

  // Add stack trace in development
  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

/**
 * Async handler wrapper to catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create error from known error types
 * @param {string} type - Error type
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {AppError} Error instance
 */
function createError(type, message, options = {}) {
  switch (type) {
    case 'validation':
      return new ValidationError(message, options.fields);
    case 'auth':
      return new AuthenticationError(message);
    case 'forbidden':
      return new AuthorizationError(message);
    case 'notFound':
      return new NotFoundError(options.resource || message);
    case 'conflict':
      return new ConflictError(message);
    case 'rateLimit':
      return new RateLimitError(message);
    case 'external':
      return new ExternalServiceError(options.service, message);
    default:
      return new AppError(message, options.statusCode || 500, options.code);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  ERROR_CODES,
  formatErrorResponse,
  asyncHandler,
  createError,
};
