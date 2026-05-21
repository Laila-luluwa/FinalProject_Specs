const prisma = require('../lib/prisma');

/**
 * Move stock between shops within the same tenant (ACID transaction).
 * @param {number} tenantId
 * @param {number} productId
 * @param {number} fromShopId
 * @param {number} toShopId
 * @param {number} quantity
 */
async function transferStock(tenantId, productId, fromShopId, toShopId, quantity) {
  const q = Number(quantity);
  const pid = Number(productId);
  const from = Number(fromShopId);
  const to = Number(toShopId);

  if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) {
    const e = new Error('quantity must be a positive integer');
    e.statusCode = 400;
    throw e;
  }
  if (from === to) {
    const e = new Error('fromShopId and toShopId must be different');
    e.statusCode = 400;
    throw e;
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: pid, tenantId },
    });
    if (!product) {
      const e = new Error('Product not found');
      e.statusCode = 404;
      throw e;
    }

    const shops = await tx.shop.findMany({
      where: { id: { in: [from, to] }, tenantId },
      select: { id: true },
    });
    if (shops.length !== 2) {
      const e = new Error('One or both shops not found for your tenant');
      e.statusCode = 404;
      throw e;
    }

    const fromInventory = await tx.inventory.findFirst({
      where: { productId: pid, shopId: from },
    });

    if (!fromInventory || fromInventory.quantity < q) {
      const e = new Error('Insufficient stock to transfer');
      e.statusCode = 409;
      throw e;
    }

    await tx.inventory.update({
      where: { id: fromInventory.id },
      data: { quantity: fromInventory.quantity - q },
    });

    const toInventory = await tx.inventory.findFirst({
      where: { productId: pid, shopId: to },
    });

    if (toInventory) {
      await tx.inventory.update({
        where: { id: toInventory.id },
        data: { quantity: toInventory.quantity + q },
      });
    } else {
      await tx.inventory.create({
        data: { productId: pid, shopId: to, quantity: q },
      });
    }

    return { message: 'Transfer successful', productId: pid, fromShopId: from, toShopId: to, quantity: q };
  }, { isolationLevel: 'Serializable' });
}

module.exports = { transferStock };
