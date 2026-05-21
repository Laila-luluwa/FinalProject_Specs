const prisma = require('../lib/prisma');

function calculateLineTotal(quantity, unitPrice) {
  return quantity * unitPrice;
}

function calculateOrderTotal(items) {
  return items.reduce((sum, item) => sum + item.lineTotal, 0);
}

async function createOrder(userId, shopId, items) {
  if (!items?.length) {
    const err = new Error('Order must contain at least one item');
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    const shop = await tx.shop.findFirst({
      where: { id: shopId, tenantId: user.tenantId },
    });
    if (!shop) {
      const err = new Error('Shop not found for your tenant');
      err.status = 404;
      throw err;
    }

    const lineItems = [];

    for (const item of items) {
      const inventory = await tx.inventory.findFirst({
        where: { productId: item.productId, shopId },
      });

      if (!inventory || inventory.quantity < item.quantity) {
        const err = new Error(`Insufficient stock for product ${item.productId}`);
        err.status = 409;
        throw err;
      }

      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId: user.tenantId },
      });
      if (!product) {
        const err = new Error(`Product ${item.productId} not found`);
        err.status = 404;
        throw err;
      }

      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: inventory.quantity - item.quantity },
      });

      lineItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        lineTotal: calculateLineTotal(item.quantity, product.price),
      });
    }

    const total = calculateOrderTotal(lineItems);

    const order = await tx.order.create({
      data: {
        userId,
        shopId,
        tenantId: user.tenantId,
        total,
        status: 'PENDING',
        items: {
          create: lineItems.map(({ productId, quantity, price }) => ({
            productId,
            quantity,
            price,
          })),
        },
      },
      include: { items: true, shop: true },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: 'CREATE_ORDER',
        entity: 'ORDER',
        entityId: order.id,
      },
    });

    return order;
  }, { isolationLevel: 'Serializable' });
}

module.exports = {
  createOrder,
  calculateLineTotal,
  calculateOrderTotal,
};
