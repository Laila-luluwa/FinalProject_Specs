const PRISMA_ERRORS = {
  P2002: { status: 409, message: 'Resource already exists' },
  P2025: { status: 404, message: 'Resource not found' }
};

function errorHandler(err, req, res, next) {
  console.error('ERROR:', {
    message: err.message,
    stack: err.stack,  // Log full error internally
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Don't leak Prisma codes or SQL to client
  if (err.code && PRISMA_ERRORS[err.code]) {
    const { status, message } = PRISMA_ERRORS[err.code];
    return res.status(status).json({ error: message });
  }

  // Generic message for unknown errors
  const message = process.env.NODE_ENV === 'development' 
    ? err.message  // Detailed in dev only
    : 'Internal Server Error';  // Generic in production

  res.status(err.status || 500).json({ 
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = (err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: 'Server error'
  });
};