const express = require('express');
const router = express.Router();

const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: "Too many requests"
  }
});

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, tenantId } = req.body;

    if (!name || !email || !password || !tenantId) {
      return res.status(400).json({
        error: 'Missing fields'
      });
    }

    // password validation
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    // check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already exists'
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        tenantId,
        role: "CASHIER"
      }
    });

    res.status(201).json({
      message: 'User registered',
      userId: user.id
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = uuidv4();

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id
      }
    });

    res.json({
      accessToken,
      refreshToken
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!tokenRecord || tokenRecord.revoked) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenRecord.userId }
    });

    if (!user || !user.active) {
      return res.status(403).json({ error: 'User inactive or not found' });
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // 👉 ВСТАВЛЯЕШЬ ВОТ СЮДА
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing token' });
    }

    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revoked: true }
    });

    res.json({ message: 'Logged out successfully' });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get("/protected", requireAuth, (req, res) => {
  res.json({
    message: "Access granted",
    user: req.user
  });
});

router.get(
  "/admin",
  requireAuth,
  requireRole("OWNER"),
  (req, res) => {
    res.json({
      message: "Admin access granted",
      user: req.user.role 
    });
  }
);

router.get(
  "/cashier",
  requireAuth,
  requireRole("CASHIER"),
  (req, res) => {
    res.json({
      message: "Cashier access granted",
      user: req.user.role
    });
  }
);

router.get(
  "/manager",
  requireAuth,
  requireRole("MANAGER"),
  (req, res) => {
    res.json({
      message: "MANAGER access granted",
      user: req.user.role
    });
  }
);

router.get(
  "/viewer",
  requireAuth,
  requireRole("VIEWER"),
  async (req, res) => {
    const data = await prisma.inventory.findMany();

    res.json(data);
  }
);

router.get(
  "/audit",
  requireAuth,
  requireRole("AUDITOR"),
  async (req, res) => {

    const logs = await prisma.auditLog.findMany();

    res.json(logs);
  }
);

module.exports = router;