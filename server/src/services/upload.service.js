/**
 * Upload Service
 * File upload handling with Multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { generateId } = require('../utils/helpers');
const logger = require('../config/logger');

// Upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc'];

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Max files per upload
const MAX_FILES = 10;

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    logger.info(`Created upload directory: ${UPLOAD_DIR}`);
  }
}

// Initialize upload directory
ensureUploadDir();

/**
 * Storage configuration
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const id = generateId();
    const ext = path.extname(file.originalname).toLowerCase();
    const storedFilename = `${id}${ext}`;
    cb(null, storedFilename);
  },
});

/**
 * File filter
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error(`File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
    error.statusCode = 400;
    return cb(error, false);
  }
  
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error('Invalid file type');
    error.statusCode = 400;
    return cb(error, false);
  }
  
  cb(null, true);
};

/**
 * Multer upload configuration
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
});

/**
 * Single file upload middleware
 */
const uploadSingle = upload.single('file');

/**
 * Multiple files upload middleware
 */
const uploadMultiple = upload.array('files', MAX_FILES);

/**
 * Wrap multer middleware with promise
 * @param {Function} uploadMiddleware
 * @returns {Function}
 */
function wrapMulter(uploadMiddleware) {
  return (req, res) => {
    return new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              const error = new Error(`File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
              error.statusCode = 400;
              reject(error);
            } else if (err.code === 'LIMIT_FILE_COUNT') {
              const error = new Error(`Too many files. Maximum: ${MAX_FILES} files`);
              error.statusCode = 400;
              reject(error);
            } else {
              reject(err);
            }
          } else {
            reject(err);
          }
        } else {
          resolve();
        }
      });
    });
  };
}

/**
 * Delete a file
 * @param {string} filePath
 * @returns {Promise<void>}
 */
async function deleteFile(filePath) {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(UPLOAD_DIR, filePath);
    await fs.unlink(fullPath);
    logger.info(`Deleted file: ${filePath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.error(`Failed to delete file: ${filePath}`, error);
      throw error;
    }
  }
}

/**
 * Get file info
 * @param {Object} file - Multer file object
 * @returns {Object}
 */
function getFileInfo(file) {
  return {
    originalFilename: file.originalname,
    storedFilename: file.filename,
    filePath: path.join(UPLOAD_DIR, file.filename),
    fileSize: file.size,
    mimeType: file.mimetype,
  };
}

/**
 * Get upload directory path
 * @returns {string}
 */
function getUploadDir() {
  return UPLOAD_DIR;
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  wrapMulter,
  deleteFile,
  getFileInfo,
  getUploadDir,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES,
};
