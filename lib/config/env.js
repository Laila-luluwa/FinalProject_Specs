// In Docker Compose, use only container env (host .env must not override DATABASE_URL / REDIS_URL).
if (!process.env.DOCKER_COMPOSE) {
  require('dotenv').config({ override: false });
}

// Map DeployRocks / course rubric names → app variables
if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL;
}
if (!process.env.JWT_SECRET && process.env.JWT_SECRET_KEY) {
  process.env.JWT_SECRET = process.env.JWT_SECRET_KEY;
}
if (!process.env.EMAIL_FROM && process.env.EMAIL_FROM_ADDRESS) {
  process.env.EMAIL_FROM = process.env.EMAIL_FROM_ADDRESS;
}
if (!process.env.NODE_ENV && process.env.ENVIRONMENT) {
  process.env.NODE_ENV = process.env.ENVIRONMENT;
}
// Brevo: SMTP_HOST=smtp-relay.brevo.com, SMTP_USER=your Brevo login email, SMTP_PASS=SMTP key (xsmtpsib-...)
if (!process.env.SMTP_PASS && process.env.BREVO_API_KEY) {
  process.env.SMTP_PASS = process.env.BREVO_API_KEY;
}
if (!process.env.SMTP_HOST && (process.env.BREVO_API_KEY || process.env.BREVO_SMTP_HOST)) {
  process.env.SMTP_HOST = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
}
// SendGrid rubric: EMAIL_API_KEY
if (!process.env.SMTP_PASS && process.env.EMAIL_API_KEY) {
  process.env.SMTP_PASS = process.env.EMAIL_API_KEY;
  if (!process.env.SMTP_USER) process.env.SMTP_USER = 'apikey';
  if (!process.env.SMTP_HOST) process.env.SMTP_HOST = 'smtp.sendgrid.net';
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
