const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// POST /tenants — создать тенанта (публичный, для регистрации)
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const tenant = await prisma.tenant.create({ data: { name } });
    res.status(201).json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tenants — список (только OWNER/MANAGER)
router.get('/', requireAuth, requireRole('MANAGER'), async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany();
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;