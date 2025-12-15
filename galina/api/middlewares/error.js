// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('❌ Express error:', err);
  console.error('❌ Error stack:', err.stack);
  console.error('❌ Request:', req.method, req.url);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = { errorHandler };
