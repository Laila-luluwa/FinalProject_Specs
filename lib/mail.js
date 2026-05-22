const nodemailer = require('nodemailer');

/** Apply Brevo / rubric env aliases before creating transport. */
function resolveSmtpConfig() {
  if (!process.env.SMTP_HOST && process.env.BREVO_SMTP_HOST) {
    process.env.SMTP_HOST = process.env.BREVO_SMTP_HOST;
  }
  if (!process.env.SMTP_HOST && (process.env.BREVO_API_KEY || process.env.EMAIL_API_KEY)) {
    process.env.SMTP_HOST = 'smtp-relay.brevo.com';
  }
  if (!process.env.SMTP_PORT) {
    process.env.SMTP_PORT = '587';
  }
  if (!process.env.SMTP_PASS && process.env.BREVO_API_KEY) {
    process.env.SMTP_PASS = process.env.BREVO_API_KEY;
  }
  if (!process.env.SMTP_PASS && process.env.EMAIL_API_KEY) {
    process.env.SMTP_PASS = process.env.EMAIL_API_KEY;
  }
  if (!process.env.EMAIL_FROM && process.env.EMAIL_FROM_ADDRESS) {
    process.env.EMAIL_FROM = process.env.EMAIL_FROM_ADDRESS;
  }

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.EMAIL_FROM?.trim() || 'LeanStock <no-reply@leanstock.local>';

  return { host, port, user, pass, from };
}

function createTransporter() {
  const { host, port, user, pass } = resolveSmtpConfig();
  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: port === 587 ? { minVersion: 'TLSv1.2' } : undefined,
  });
}

let transporter = createTransporter();

function getTransporter() {
  if (!transporter) transporter = createTransporter();
  return transporter;
}

function smtpConfigured() {
  const { host, user, pass } = resolveSmtpConfig();
  return Boolean(host && user && pass);
}

async function verifySmtpConnection() {
  if (!smtpConfigured()) {
    console.warn('[SMTP] Not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS (Brevo: smtp-relay.brevo.com + SMTP key)');
    return false;
  }
  const t = getTransporter();
  try {
    await t.verify();
    const { host, port } = resolveSmtpConfig();
    console.log(`[SMTP] Ready → ${host}:${port}`);
    return true;
  } catch (err) {
    console.error('[SMTP] Connection failed:', err.message);
    return false;
  }
}

/** Send immediately (Brevo / Gmail) — used on Render when queue is off or Redis down. */
async function sendMailDirect({ to, subject, html }) {
  if (!smtpConfigured()) {
    throw new Error('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)');
  }
  const t = getTransporter();
  const { from } = resolveSmtpConfig();
  const info = await t.sendMail({ from, to, subject, html });
  console.log(`[SMTP] Sent "${subject}" → ${to} (messageId: ${info.messageId || 'ok'})`);
  return info;
}

function useDirectSmtpOnly() {
  return (
    process.env.EMAIL_DIRECT === '1'
    || process.env.SKIP_REDIS_QUEUES === '1'
    || process.env.NODE_ENV === 'production'
    || process.env.RENDER === 'true'
  );
}

module.exports = {
  resolveSmtpConfig,
  getTransporter,
  smtpConfigured,
  verifySmtpConnection,
  sendMailDirect,
  useDirectSmtpOnly,
};
