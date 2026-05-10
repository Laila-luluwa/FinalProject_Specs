const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Strict limit for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // Don't count successful logins
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many attempts. Try again in 15 minutes.'
    });
  },
  // Store attempts by IP + email combination
  keyGenerator: (req) => {
  const ip = ipKeyGenerator(req);
  return `${ip}-${req.body.email || 'unknown'}`;
}
});

// General API limit (less strict)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 5,  // 5 requests per minute per IP
  message: 'Rate limit exceeded. Slow down.'
});

module.exports = { authLimiter, apiLimiter };
