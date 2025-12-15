// Multer error handling middleware
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('🚨 Multer error:', error.code, error.message);
    return res.status(400).json({
      error: 'File upload error',
      details: error.message,
      code: error.code
    });
  }
  next(error);
};

module.exports = { handleMulterError };
