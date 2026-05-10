const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');


// ==================== READ ALL ====================
router.get('/', async (req, res) => {
  try {
    const { skip = 0, limit = 100 } = req.query;

    const users = await prisma.user.findMany({
      skip: Number(skip),
      take: Number(limit)
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});


// ==================== READ ONE ====================
router.get('/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});


// ==================== SEARCH (SQL-safe) ====================
router.get('/secure/users/search', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || name.length > 50) {
      return res.status(400).json({ error: 'Invalid search term' });
    }

    const users = await prisma.user.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        active: true
      }
    });

    res.json({ count: users.length, data: users });

  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});


// ==================== CREATE ====================
router.post('/', async (req, res) => {
  try {
    const { name, email, active } = req.body;

    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        active
      }
    });

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'User creation failed' });
  }
});


// ==================== UPDATE (SAFE - NO MASS ASSIGNMENT) ====================
const ALLOWED_UPDATE_FIELDS = ['name', 'email', 'avatar'];

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    const currentRole = req.user.role;

    // ❗ можно менять только себя или если админ
    if (currentUserId !== targetId && currentRole !== 'admin') {
      return res.status(403).json({ error: 'Can only update own profile' });
    }

    // ✅ whitelist (главная защита)
    const updateData = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // 🔐 admin-only поле
    if (currentRole === 'admin' && req.body.active !== undefined) {
      updateData.active = req.body.active;
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        role: true
      }
    });

    res.json(updatedUser);

  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});


// ==================== DELETE ====================
router.delete('/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});


router.get("/protected", requireAuth, (req, res) => {
  res.json({
    message: "Access granted",
    user: req.user
  });
});

module.exports = router;