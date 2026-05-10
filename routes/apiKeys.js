// File: routes/apiKeys.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { apiLimiter } = require('../middleware/rateLimit');

// Limit API key generation (prevents abuse)
router.post('/', requireAuth, apiLimiter, async (req, res) => {
  // Existing Part 5 code
});


// POST /api/api-keys - Create new API key
router.post('/', requireAuth, async (req, res) => {
    const { name = 'Production', plan = 'free' } = req.body;
    const userId = req.user.sub;
    
    // Generate secure key: ak_live_ + 32 random bytes
    const rawKey = `ak_live_${crypto.randomBytes(32).toString('base64url')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    
    // Determine quota by plan
    const quotas = { free: 100, basic: 1000, pro: 10000 };
    const quota = quotas[plan] || 100;
    
    const apiKey = await prisma.apiKey.create({
        data: {
            userId,
            keyPrefix: rawKey.substring(0, 8),
            keyHash,
            name,
            plan,
            monthlyQuota: quota
        }
    });
    
    res.status(201).json({
        message: 'API key created. Save immediately - will not be shown again!',
        apiKey: rawKey,  // ONE TIME ONLY
        prefix: rawKey.substring(0, 8),
        name: apiKey.name,
        plan: apiKey.plan,
        monthlyQuota: quota
    });
});

// GET /api/api-keys - List user's API keys
router.get('/', requireAuth, async (req, res) => {
    const keys = await prisma.apiKey.findMany({
        where: { userId: req.user.sub },
        select: {
            id: true,
            keyPrefix: true,
            name: true,
            status: true,
            plan: true,
            requestsThisMonth: true,
            createdAt: true
        }
    });
    res.json(keys);
});

// DELETE /api/api-keys/:id - Revoke API key
router.delete('/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    
    const key = await prisma.apiKey.findFirst({
        where: { id, userId: req.user.sub }
    });
    
    if (!key) return res.status(404).json({ error: 'Key not found' });
    
    await prisma.apiKey.update({
        where: { id },
        data: { status: 'revoked' }
    });
    
    res.status(204).send();
});

module.exports = router;
