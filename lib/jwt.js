const jwt = require('jsonwebtoken');
const crypto = require('crypto');


// Generate strong secret if not exists (store in .env for production)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const REFRESH_SECRET = process.env.REFRESH_SECRET || crypto.randomBytes(64).toString('hex');

const JWT_EXPIRES_IN = '15m';  // Short-lived access tokens
const REFRESH_EXPIRES_IN = '7d';

function signAccessToken(user) {
  return jwt.sign(
    { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      type: 'access'  // Explicit token type
    },
    JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRES_IN,
      algorithm: 'HS512',  // Strong algorithm only
      issuer: 'backend-lab',
      audience: 'api-users'
    }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN, algorithm: 'HS512' }
  );
}

function verifyAccessToken(token) {
  // STRICT: Specify algorithm to prevent confusion attacks
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS512'],  // Reject RS256/none/weak algos
    issuer: 'backend-lab',
    audience: 'api-users'
  });
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken };
