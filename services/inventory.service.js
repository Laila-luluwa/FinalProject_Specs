const prisma = require("../lib/prisma");

async function transferStock(productId, fromShopId, toShopId, quantity) {
  return await prisma.$transaction(async (tx) => {

    // 1. Проверяем склад отправителя
    const fromInventory = await tx.inventory.findFirst({
      where: {
        productId,
        shopId: fromShopId,
      },
    });

    if (!fromInventory || fromInventory.quantity < quantity) {
      throw new Error("Insufficient stock to transfer");
    }

    // 2. Уменьшаем в Shop A
    await tx.inventory.update({
      where: { id: fromInventory.id },
      data: {
        quantity: fromInventory.quantity - quantity,
      },
    });

    // 3. Проверяем есть ли запись в Shop B
    const toInventory = await tx.inventory.findFirst({
      where: {
        productId,
        shopId: toShopId,
      },
    });

    if (toInventory) {
      // если есть — увеличиваем
      await tx.inventory.update({
        where: { id: toInventory.id },
        data: {
          quantity: toInventory.quantity + quantity,
        },
      });
    } else {
      // если нет — создаём
      await tx.inventory.create({
        data: {
          productId,
          shopId: toShopId,
          quantity,
        },
      });
    }

    return { message: "Transfer successful" };
  });
}

module.exports = {
  transferStock
};