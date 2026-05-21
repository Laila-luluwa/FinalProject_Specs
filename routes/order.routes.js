const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { createOrder } = require('../services/order.service');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { sendOrderConfirmationEmail } = require('../services/email.queue');
const { parsePagination, paginatedResponse } = require('../lib/pagination');

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { shopId, items } = req.body;

    if (!shopId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'shopId and items[] are required' });
    }

    const order = await createOrder(userId, Number(shopId), items);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user?.email) {
      sendOrderConfirmationEmail(user.email, order).catch(() => {});
    }

    res.status(201).json(order);
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { tenantId: req.user.tenantId };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true, shop: true, user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.order.count({ where }),
    ]);

    res.json(paginatedResponse(orders, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.id), tenantId: req.user.tenantId },
      include: { items: true, shop: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

const ALLOWED_STATUSES = ['PENDING', 'PAID', 'CANCELLED'];

router.patch('/:id', requireAuth, requireRole(['MANAGER', 'OWNER']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be PENDING, PAID, or CANCELLED' });
    }

    const existing = await prisma.order.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true, shop: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'UPDATE_ORDER_STATUS',
        entity: 'ORDER',
        entityId: id,
      },
    });

    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
