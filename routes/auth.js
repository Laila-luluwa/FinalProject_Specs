const express = require('express');
const router = express.Router();

const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const rateLimit = require('express-rate-limit');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require('../services/email.queue');

// ==================== RATE LIMITERS ====================
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, try again in a minute' },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reset attempts' },
});

// ==================== HELPERS ====================
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== REGISTER ====================
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, tenantId } = req.body;

    if (!name || !email || !password || !tenantId) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password, tenantId' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const tid = Number(tenantId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const usersInTenant = await prisma.user.count({ where: { tenantId: tid } });
    const role = usersInTenant === 0 ? 'OWNER' : 'VIEWER';

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = generateToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        tenantId: tid,
        role,
        isVerified: false,
        verificationToken,
        verificationTokenExpiry,
      },
    });

    sendVerificationEmail(email, verificationToken).catch((err) =>
      console.error('[Auth] Failed to queue verify email:', err.message)
    );

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
      role: user.role,
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== VERIFY EMAIL ====================
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const user = await prisma.user.findFirst({ where: { verificationToken: token } });

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification token' });
    if (user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification token expired. Please register again.' });
    }
    if (user.isVerified) {
      return res.json({ message: 'Email already verified. You can log in.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null, verificationTokenExpiry: null },
    });

    sendWelcomeEmail(user.email, user.name).catch(() => {});

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('[Auth] Verify email error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== LOGIN ====================
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isVerified) {
      return res.status(403).json({ error: 'Email not verified. Please check your inbox.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Account deactivated. Contact your administrator.' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = uuidv4();
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id } });

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REFRESH TOKEN (with rotation) ====================
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const tokenRecord = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!tokenRecord || tokenRecord.revoked) {
      return res.status(403).json({ error: 'Invalid or revoked refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: tokenRecord.userId } });
    if (!user || !user.active) return res.status(403).json({ error: 'User not found or inactive' });

    const newRefreshToken = uuidv4();

    await prisma.$transaction([
      prisma.refreshToken.update({ where: { token: refreshToken }, data: { revoked: true } }),
      prisma.refreshToken.create({ data: { token: newRefreshToken, userId: user.id } }),
    ]);

    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[Auth] Refresh error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== LOGOUT ====================
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const record = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!record) return res.status(404).json({ error: 'Token not found' });

    await prisma.refreshToken.update({ where: { token: refreshToken }, data: { revoked: true } });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== FORGOT PASSWORD ====================
router.post('/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const resetToken = generateToken();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    sendPasswordResetEmail(email, resetToken).catch(() => {});

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== RESET PASSWORD ====================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findFirst({ where: { resetToken: token } });
    if (!user || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ME ====================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, name: true, email: true, role: true,
        isVerified: true, active: true, createdAt: true, tenantId: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ROLE-GATED ENDPOINTS ====================
router.get('/protected', requireAuth, (req, res) => {
  res.json({ message: 'Access granted', user: req.user });
});

router.get('/admin', requireAuth, requireRole('OWNER'), (req, res) => {
  res.json({ message: 'Owner access granted', role: req.user.role });
});

router.get('/manager', requireAuth, requireRole('MANAGER'), (req, res) => {
  res.json({ message: 'Manager access granted', role: req.user.role });
});

router.get('/cashier', requireAuth, requireRole('CASHIER'), (req, res) => {
  res.json({ message: 'Cashier access granted', role: req.user.role });
});

router.get('/viewer', requireAuth, requireRole('VIEWER'), async (req, res) => {
  const data = await prisma.inventory.findMany({ take: 50 });
  res.json(data);
});

router.get('/audit', requireAuth, requireRole('AUDITOR'), async (req, res) => {
  const logs = await prisma.auditLog.findMany({ take: 100 });
  res.json(logs);
});

module.exports = router;