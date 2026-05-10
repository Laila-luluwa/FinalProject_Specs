const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const router = express.Router();
const { transferStock } = require("../services/inventory.service"); 


router.post(
  "/transfer",
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
  try {
    const { productId, fromShopId, toShopId, quantity } = req.body;

    const result = await transferStock(
      productId,
      fromShopId,
      toShopId,
      quantity
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const data = await prisma.inventory.findMany({
      include: {
        product: true,
        shop: true
      }
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); 

router.post("/add", requireAuth, requireRole("MANAGER"), async (req, res) => {
  try {
    const { productId, shopId, quantity } = req.body;

    const inventory = await prisma.inventory.create({
      data: {
        productId,
        shopId,
        quantity
      }
    });

    res.status(201).json(inventory);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;