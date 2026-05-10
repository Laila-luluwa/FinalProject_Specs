const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma"); // ← вот это важно
const { createOrder } = require("../services/order.service");
const { requireAuth } = require('../middleware/auth');

router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId; // ← из токена
    const { shopId, items } = req.body;

    if (!shopId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    const order = await createOrder(userId, shopId, items);

    res.status(201).json(order);
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(400).json({ error: err.message });
  }
});
router.get("/", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const orders = await prisma.order.findMany({
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: true,
        user: true,
        shop: true
      }
    });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/products", async (req, res) => {
  try {
    const data = await prisma.product.findMany();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;