const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const router = express.Router();
const { transferStock } = require('../services/inventory.service');
const { sendStockTransferEmail } = require('../services/email.queue');
const { parsePagination, paginatedResponse } = require('../lib/pagination');

/** Shared handler: POST /inventory/transfer и POST /transfer */
async function stockTransferHandler(req, res, next) {
  try {
    const { productId, fromShopId, toShopId, quantity } = req.body;
    if (!productId || !fromShopId || !toShopId || quantity == null) {
      return res.status(400).json({
        error: 'productId, fromShopId, toShopId, and quantity are required',
      });
    }

    const result = await transferStock(
      req.user.tenantId,
      Number(productId),
      Number(fromShopId),
      Number(toShopId),
      Number(quantity)
    );

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true },
    });
    if (user?.email) {
      sendStockTransferEmail(user.email, {
        productId,
        fromShopId,
        toShopId,
        quantity,
      }).catch(() => {});
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'STOCK_TRANSFER',
        entity: 'INVENTORY',
        entityId: Number(productId),
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

router.post('/transfer', requireAuth, requireRole('MANAGER'), stockTransferHandler);

router.get('/shops', requireAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { tenantId: req.user.tenantId };
    const [data, total] = await Promise.all([
      prisma.shop.findMany({ where, skip, take: limit, orderBy: { id: 'asc' } }),
      prisma.shop.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.post('/shops', requireAuth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const shop = await prisma.shop.create({
      data: { name, location: location || null, tenantId: req.user.tenantId },
    });
    res.status(201).json(shop);
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const shops = await prisma.shop.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true },
    });
    const shopIds = shops.map((s) => s.id);

    const where = { shopId: { in: shopIds } };

    const [data, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        include: { product: true, shop: true },
      }),
      prisma.inventory.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.post('/add', requireAuth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const { productId, shopId, quantity } = req.body;
    if (!productId || !shopId || quantity == null) {
      return res.status(400).json({ error: 'productId, shopId, and quantity are required' });
    }

    const shop = await prisma.shop.findFirst({
      where: { id: Number(shopId), tenantId: req.user.tenantId },
    });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const inventory = await prisma.inventory.create({
      data: {
        productId: Number(productId),
        shopId: Number(shopId),
        quantity: Number(quantity),
      },
    });

    res.status(201).json(inventory);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Inventory record already exists for this product and shop' });
    }
    next(err);
  }
});

module.exports = router;
module.exports.stockTransferHandler = stockTransferHandler;
