const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const express = require('express');
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");


// =========================
// CREATE PRODUCT
// MANAGER ONLY
// =========================
router.post(
  '/',
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {

      const { name, price } = req.body;

      if (!name || !price) {
        return res.status(400).json({
          error: 'Missing fields'
        });
      }

      const product = await prisma.product.create({
        data: {
          name,
          price,
          tenantId: 3
        }
      });

      res.status(201).json(product);

    } catch (error) {

      console.log(error);

      res.status(500).json({
        error: 'Error creating product'
      });
    }
  }
);


// =========================
// GET ALL PRODUCTS
// PUBLIC
// =========================
router.get('/', async (req, res) => {
  try {

    const products = await prisma.product.findMany();

    res.json(products);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: 'Error fetching products'
    });
  }
});


// =========================
// GET PRODUCT BY ID
// PUBLIC
// =========================
router.get('/:id', async (req, res) => {
  try {

    const product = await prisma.product.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json(product);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: 'Error fetching product'
    });
  }
});


// =========================
// UPDATE PRODUCT
// MANAGER ONLY
// =========================
router.patch(
  '/:id',
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {

    try {

      const id = parseInt(req.params.id);

      const { name, price } = req.body;

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          name,
          price
        }
      });

      res.json(updatedProduct);

    } catch (error) {

      console.log(error);

      if (error.code === 'P2025') {
        return res.status(404).json({
          error: 'Product not found'
        });
      }

      res.status(500).json({
        error: 'Update failed'
      });
    }
  }
);


// =========================
// DELETE PRODUCT
// OWNER ONLY
// =========================
router.delete(
  '/:id',
  requireAuth,
  requireRole("OWNER"),
  async (req, res) => {

    try {

      await prisma.product.delete({
        where: {
          id: parseInt(req.params.id)
        }
      });

      res.json({
        message: 'Product deleted'
      });

    } catch (error) {

      console.log(error);

      res.status(404).json({
        error: 'Product not found'
      });
    }
  }
);


// =========================
// DEAD STOCK DECAY
// MANAGER ONLY
// =========================
router.post(
  '/decay/:id',
  requireAuth,
  requireRole("MANAGER"),
  async (req, res) => {

    try {

      const productId = parseInt(req.params.id);

      const product = await prisma.product.findUnique({
        where: {
          id: productId
        }
      });

      if (!product) {
        return res.status(404).json({
          error: 'Product not found'
        });
      }

      // configurable discount
      const decayPercent = 0.10;

      const newPrice = product.price * (1 - decayPercent);

      const updatedProduct = await prisma.product.update({
        where: {
          id: productId
        },
        data: {
          price: newPrice
        }
      });

      // save price history
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          oldPrice: product.price,
          newPrice
        }
      });

      res.json({
        message: 'Dead stock decay applied',
        oldPrice: product.price,
        newPrice,
        updatedProduct
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        error: 'Decay failed'
      });
    }
  }
);

module.exports = router;