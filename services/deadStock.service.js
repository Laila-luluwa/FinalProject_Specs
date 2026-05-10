const prisma = require("../lib/prisma");

async function applyDiscounts() {
  const products = await prisma.product.findMany();

  const now = new Date();

  for (const product of products) {
    const diffDays = Math.floor(
      (now - product.createdAt) / (1000 * 60 * 60 * 24)
    );

    if (diffDays > 0) {
      const discountSteps = Math.floor((diffDays - 30) / 3);
      const discount = 0.1 * discountSteps;

      const newPrice = product.price * (1 - discount);

      await prisma.product.update({
        where: { id: product.id },
        data: {
          price: Math.max(newPrice, 1),
        },
      });

      console.log(`Discount applied to product ${product.id}`);
    }
  }
}

module.exports = {
  applyDiscounts,
};