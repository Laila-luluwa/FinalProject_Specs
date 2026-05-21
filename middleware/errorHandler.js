const PRISMA_ERRORS = {
  P2002: { status: 409, message: 'Resource already exists' },
  P2025: { status: 404, message: 'Resource not found' },
};

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  console.error('ERROR:', {
    message: err.message,
    code: err.code,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS blocked' });
  }

  if (err.code && PRISMA_ERRORS[err.code]) {
    const { status, message } = PRISMA_ERRORS[err.code];
    return res.status(status).json({ error: message });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === 'development' && status === 500
      ? err.message
      : status === 500
        ? 'Internal server error'
        : err.message;

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && status === 500 && { stack: err.stack }),
  });
}

module.exports = errorHandler;
