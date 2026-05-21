const prisma = require('../lib/prisma');
const { calculateDeadStockPrice } = require('../lib/deadStock');
const { sendPriceDecayEmail } = require('./email.queue');

async function applyDiscounts() {
  const products = await prisma.product.findMany();
  const now = new Date();
  let updated = 0;

  for (const product of products) {
    const newPrice = calculateDeadStockPrice(product.price, product.createdAt, now);
    if (newPrice === product.price) continue;

    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { price: newPrice },
      }),
      prisma.priceHistory.create({
        data: {
          productId: product.id,
          oldPrice: product.price,
          newPrice,
        },
      }),
    ]);

    const managers = await prisma.user.findMany({
      where: { tenantId: product.tenantId, role: 'MANAGER', active: true },
      select: { email: true },
    });

    for (const m of managers) {
      sendPriceDecayEmail(m.email, product, product.price, newPrice).catch(() => {});
    }

    updated += 1;
    console.log(`[DeadStock] Product ${product.id}: ${product.price} → ${newPrice}`);
  }

  return { updated, processed: products.length };
}

module.exports = { applyDiscounts, calculateDeadStockPrice };
