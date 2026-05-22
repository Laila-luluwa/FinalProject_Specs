const { Queue, Worker } = require('bullmq');
const { getRedisConnection } = require('../lib/redis');
const {
  sendMailDirect,
  useDirectSmtpOnly,
  smtpConfigured,
} = require('../lib/mail');

let emailQueue;
let emailWorker;
let initialized = false;

function initEmailQueue() {
  if (initialized) return Boolean(emailQueue);
  initialized = true;

  if (process.env.SKIP_REDIS_QUEUES === '1') {
    return false;
  }

  if (!process.env.REDIS_URL?.trim() && process.env.DOCKER_COMPOSE !== '1') {
    console.warn('[Email Queue] No REDIS_URL — using direct SMTP');
    return false;
  }

  const redisConnection = getRedisConnection();
  if (!redisConnection) return false;

  const { getTransporter, resolveSmtpConfig } = require('../lib/mail');
  const transport = getTransporter();
  if (!transport) return false;

  emailQueue = new Queue('email', { connection: redisConnection });
  emailWorker = new Worker(
    'email',
    async (job) => {
      const { to, subject, html } = job.data;
      await sendMailDirect({ to, subject, html });
      console.log(`[Email Queue] Worker sent "${subject}" to ${to}`);
    },
    { connection: redisConnection }
  );
  emailWorker.on('failed', (job, err) => {
    console.error(`[Email Queue] Job ${job?.id} failed:`, err.message);
  });
  console.log('[Email Queue] Worker started');
  return true;
}

async function sendEmail({ to, subject, html }) {
  if (!smtpConfigured()) {
    console.error('[Email] Cannot send — SMTP_HOST / SMTP_USER / SMTP_PASS missing');
    throw new Error('Email service not configured');
  }

  if (useDirectSmtpOnly()) {
    return sendMailDirect({ to, subject, html });
  }

  if (!initEmailQueue()) {
    return sendMailDirect({ to, subject, html });
  }

  await emailQueue.add('send', { to, subject, html }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  });
}

async function sendVerificationEmail(email, token) {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const link = `${base}/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your email — LeanStock',
    html: `
      <h2>Welcome to LeanStock</h2>
      <p>Click to verify your email:</p>
      <p><a href="${link}" style="padding:10px 20px;background:#6c63ff;color:white;text-decoration:none;border-radius:6px;">Verify Email</a></p>
      <p>Or copy this link:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Expires in 24 hours.</p>
    `,
  });
}

async function sendPasswordResetEmail(email, token) {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const link = `${base}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Password Reset — LeanStock',
    html: `
      <h2>Password Reset</h2>
      <p><a href="${link}">Reset your password</a></p>
      <p>Expires in 1 hour.</p>
    `,
  });
}

async function sendOrderConfirmationEmail(email, order) {
  await sendEmail({
    to: email,
    subject: `Order #${order.id} Confirmed — LeanStock`,
    html: `
      <h2>Order Confirmed</h2>
      <p>Order <strong>#${order.id}</strong> — total $${order.total}</p>
    `,
  });
}

async function sendWelcomeEmail(email, name) {
  await sendEmail({
    to: email,
    subject: 'Welcome to LeanStock',
    html: `<h2>Welcome, ${name}!</h2><p>Your email is verified. You can log in now.</p>`,
  });
}

async function sendStockTransferEmail(email, transfer) {
  await sendEmail({
    to: email,
    subject: 'Stock Transfer — LeanStock',
    html: `<p>Product #${transfer.productId}: ${transfer.quantity} units moved between shops.</p>`,
  });
}

async function sendPriceDecayEmail(email, product, oldPrice, newPrice) {
  await sendEmail({
    to: email,
    subject: `Price update: ${product.name}`,
    html: `<p>${product.name}: $${oldPrice} → $${newPrice}</p>`,
  });
}

async function getEmailQueueStats() {
  if (!initEmailQueue()) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, disabled: true, mode: 'direct-smtp' };
  }
  const counts = await emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  return { ...counts, mode: 'bullmq' };
}

module.exports = {
  get emailQueue() {
    initEmailQueue();
    return emailQueue;
  },
  get emailWorker() {
    initEmailQueue();
    return emailWorker;
  },
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendWelcomeEmail,
  sendStockTransferEmail,
  sendPriceDecayEmail,
  getEmailQueueStats,
};
