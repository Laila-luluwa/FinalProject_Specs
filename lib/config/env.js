require('dotenv').config();

// DeployRocks rubric names JWT_SECRET_KEY; app accepts either
if (!process.env.JWT_SECRET && process.env.JWT_SECRET_KEY) {
  process.env.JWT_SECRET = process.env.JWT_SECRET_KEY;
}

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
const REQUIRED_IN_PRODUCTION = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `FATAL: Missing required environment variables: ${missing.join(', ')}. See .env.example`
    );
  }

  if (process.env.NODE_ENV === 'production') {
    const prodMissing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
    if (prodMissing.length) {
      throw new Error(
        `FATAL: Missing production email config: ${prodMissing.join(', ')}`
      );
    }
    if (process.env.CORS_ORIGINS === '*') {
      throw new Error('FATAL: Wildcard CORS is not allowed in production');
    }
  }
}

module.exports = { validateEnv };
