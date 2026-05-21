const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// Safe fields to return — NEVER return passwordHash
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  isVerified: true,   // поле в schema называется isVerified
  createdAt: true,
  tenantId: true,
};

const VALID_ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'VIEWER', 'AUDITOR'];

// ==================== SEARCH ====================
// ВАЖНО: /search/q должен быть ВЫШЕ /:userId
// иначе Express воспримет "search" как :userId
router.get('/search/q', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || name.length > 50) {
      return res.status(400).json({ error: 'Invalid search term (max 50 chars)' });
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId: req.user.tenantId,
        name: { contains: name, mode: 'insensitive' },
      },
      select: USER_SELECT,
    });

    res.json({ count: users.length, data: users });
  } catch (err) {
    console.error('[Users] Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ==================== GET ALL USERS ====================
// OWNER only — scoped to their tenant, with pagination
router.get('/', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: { tenantId: req.user.tenantId },
        select: USER_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: { tenantId: req.user.tenantId } }),
    ]);

    res.json({
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Users] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ==================== GET ONE USER ====================
// OWNER only — must be same tenant
// ВАЖНО: этот роут ПОСЛЕ /search/q
router.get('/:userId', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.user.tenantId },
      select: USER_SELECT,
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    console.error('[Users] GET /:userId error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ==================== CREATE USER (OWNER only) ====================
// Только OWNER создаёт пользователей и назначает роли
router.post('/', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const assignedRole = role && VALID_ROLES.includes(role) ? role : 'CASHIER';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: assignedRole,
        tenantId: req.user.tenantId,  // всегда привязан к tenant OWNER'а
        isVerified: true,           // созданные админом — сразу верифицированы
        active: true,
      },
      select: USER_SELECT,
    });

    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (err) {
    console.error('[Users] POST / error:', err);
    res.status(500).json({ error: 'User creation failed' });
  }
});



// ==================== CHANGE ROLE (OWNER only) ====================
router.patch('/:userId/role', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const target = await prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.user.tenantId },
    });
    if (!target) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: req.params.userId },
      data: { role },
      select: USER_SELECT,
    });

    res.json({ message: 'Role updated', user: updated });
  } catch (err) {
    console.error('[Users] PATCH role error:', err);
    res.status(500).json({ error: 'Role update failed' });
  }
});

// ==================== UPDATE OWN PROFILE ====================
// Любой авторизованный может менять только своё имя
const ALLOWED_SELF_UPDATE = ['name'];

router.put('/me/profile', requireAuth, async (req, res) => {
  try {
    const updateData = {};
    for (const field of ALLOWED_SELF_UPDATE) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // req.user.userId — именно так JWT middleware кладёт id
    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: USER_SELECT,
    });

    res.json(updated);
  } catch (err) {
    console.error('[Users] PUT profile error:', err);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// ==================== DEACTIVATE USER (OWNER only) ====================
// Soft delete — active: false вместо физического удаления
router.delete('/:userId', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const target = await prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.user.tenantId },
    });

    if (!target) return res.status(404).json({ error: 'User not found' });

    // OWNER не может деактивировать сам себя
    if (target.id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.userId },
      data: { active: false },
      select: USER_SELECT,
    });

    res.json({ message: 'User deactivated', user: updated });
  } catch (err) {
    console.error('[Users] DELETE error:', err);
    res.status(500).json({ error: 'Deactivation failed' });
  }
});

module.exports = router;