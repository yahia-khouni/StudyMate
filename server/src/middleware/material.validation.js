/**
 * Material Validation Middleware
 * Validate material-related requests
 */

/**
 * Validate material ID parameter
 */
function validateMaterialId(req, res, next) {
  const { materialId } = req.params;
  
  // IDs are UUIDs (strings)
  if (!materialId || typeof materialId !== 'string' || materialId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid material ID',
    });
  }
  
  next();
}

/**
 * Handle multer file upload errors
 */
function handleUploadError(err, req, res, next) {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 50MB.',
      });
    }
    
    if (err.message === 'Only PDF and DOCX files are allowed') {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    
    return res.status(400).json({
      success: false,
      error: 'File upload error: ' + err.message,
    });
  }
  
  next();
}

module.exports = {
  validateMaterialId,
  handleUploadError,
};
