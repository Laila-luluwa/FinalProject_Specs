const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { parsePagination, paginatedResponse } = require('../lib/pagination');

router.post('/', requireAuth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const { name, price } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        price: Number(price),
        tenantId: req.user.tenantId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: product.id,
      },
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { tenantId: req.user.tenantId };

    const [data, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, orderBy: { id: 'asc' } }),
      prisma.product.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: Number(req.params.id), tenantId: req.user.tenantId },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.product.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(req.body.name != null && { name: req.body.name }),
        ...(req.body.price != null && { price: Number(req.body.price) }),
      },
    });

    res.json(updatedProduct);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.product.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { productId: id } });
      await tx.priceHistory.deleteMany({ where: { productId: id } });
      await tx.inventory.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/decay/:id', requireAuth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.user.tenantId },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const decayPercent = 0.1;
    const newPrice = product.price * (1 - decayPercent);

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { price: newPrice },
      });
      await tx.priceHistory.create({
        data: { productId: product.id, oldPrice: product.price, newPrice },
      });
      return updated;
    });

    res.json({
      message: 'Dead stock decay applied',
      oldPrice: product.price,
      newPrice,
      product: updatedProduct,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
