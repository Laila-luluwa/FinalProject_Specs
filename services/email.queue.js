const { Queue, Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const { getRedisConnection } = require('../lib/redis');

let emailQueue;
let emailWorker;
let initialized = false;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

function initEmailQueue() {
  if (initialized) return Boolean(emailQueue);
  initialized = true;

  if (process.env.SKIP_REDIS_QUEUES === '1') {
    return false;
  }

  if (!process.env.REDIS_URL?.trim() && process.env.DOCKER_COMPOSE !== '1') {
    console.error('[Email Queue] Disabled — set REDIS_URL (Upstash TCP URL) in Render Environment');
    return false;
  }

  const redisConnection = getRedisConnection();
  if (!redisConnection) return false;
  emailQueue = new Queue('email', { connection: redisConnection });
  emailWorker = new Worker(
    'email',
    async (job) => {
      const { to, subject, html } = job.data;
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"POS System" <no-reply@pos.com>',
        to,
        subject,
        html,
      });
      console.log(`[Email Queue] Sent "${subject}" to ${to}`);
    },
    { connection: redisConnection }
  );
  emailWorker.on('failed', (job, err) => {
    console.error(`[Email Queue] Job ${job?.id} failed:`, err.message);
  });
  return true;
}

async function sendEmailDirect({ to, subject, html }) {
  if (!process.env.SMTP_USER?.trim() || !process.env.SMTP_PASS?.trim()) {
    console.warn('[Email] SMTP not configured — email not sent to', to);
    return false;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"LeanStock" <no-reply@leanstock.local>',
    to,
    subject,
    html,
  });
  console.log(`[Email] Sent "${subject}" to ${to} (direct SMTP)`);
  return true;
}

async function sendEmail({ to, subject, html }) {
  if (process.env.SKIP_REDIS_QUEUES === '1') {
    return sendEmailDirect({ to, subject, html });
  }
  if (!initEmailQueue()) return sendEmailDirect({ to, subject, html });
  await emailQueue.add('send', { to, subject, html }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  });
}

async function sendVerificationEmail(email, token) {
  const link = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your email — POS System',
    html: `
      <h2>Welcome to POS System!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${link}" style="padding:10px 20px;background:#4F46E5;color:white;border-radius:5px;text-decoration:none;">
        Verify Email
      </a>
      <p>Link expires in 24 hours.</p>
      <p>If you did not register, ignore this email.</p>
    `,
  });
}

async function sendPasswordResetEmail(email, token) {
  const link = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Password Reset — POS System',
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${link}" style="padding:10px 20px;background:#DC2626;color:white;border-radius:5px;text-decoration:none;">
        Reset Password
      </a>
      <p>Link expires in 1 hour.</p>
      <p>If you did not request this, ignore this email.</p>
    `,
  });
}

async function sendOrderConfirmationEmail(email, order) {
  await sendEmail({
    to: email,
    subject: `Order #${order.id} Confirmed — POS System`,
    html: `
      <h2>Order Confirmed!</h2>
      <p>Your order <strong>#${order.id}</strong> has been placed successfully.</p>
      <p><strong>Total:</strong> $${order.total}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      <p>Thank you for your purchase!</p>
    `,
  });
}

async function sendWelcomeEmail(email, name) {
  await sendEmail({
    to: email,
    subject: 'Welcome to POS System!',
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>Your account has been verified successfully.</p>
      <p>You can now log in and start using the POS System.</p>
    `,
  });
}

async function sendStockTransferEmail(email, transfer) {
  await sendEmail({
    to: email,
    subject: 'Stock Transfer Completed — POS System',
    html: `
      <h2>Stock Transfer</h2>
      <p>Product <strong>#${transfer.productId}</strong> moved from shop ${transfer.fromShopId} to ${transfer.toShopId}.</p>
      <p><strong>Quantity:</strong> ${transfer.quantity}</p>
    `,
  });
}

async function sendPriceDecayEmail(email, product, oldPrice, newPrice) {
  await sendEmail({
    to: email,
    subject: `Price Update: ${product.name} — POS System`,
    html: `
      <h2>Dead Stock Discount Applied</h2>
      <p>Product <strong>${product.name}</strong> (ID ${product.id})</p>
      <p><strong>Old price:</strong> $${oldPrice}</p>
      <p><strong>New price:</strong> $${newPrice}</p>
    `,
  });
}

async function getEmailQueueStats() {
  if (!initEmailQueue()) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, disabled: true };
  }
  return emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
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
