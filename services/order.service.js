const prisma = require("../lib/prisma");

async function createOrder(userId, shopId, items) {
  return await prisma.$transaction(async (tx) => {

    let total = 0;

    for (const item of items) {

      const inventory = await tx.inventory.findFirst({
        where: {
          productId: item.productId,
          shopId: shopId,
        },
      });

      if (!inventory || inventory.quantity < item.quantity) {
        throw new Error("Insufficient stock");
      }

      // 🔥 получаем цену из БД
      const product = await tx.product.findUnique({
        where: { id: item.productId }
      });

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: inventory.quantity - item.quantity,
        },
      });

      total += item.quantity * product.price;
    }

    const order = await tx.order.create({
      data: {
        userId,
        shopId,
        total,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: 0 // можно заменить позже, если хочешь
          })),
        },
      },
      include: { items: true },
    });

    return order;
  });
}

module.exports = { createOrder };