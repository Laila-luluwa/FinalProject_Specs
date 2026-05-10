const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  // 👉 сначала создаём tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: "Main Tenant"
    }
  });

  const tenant = await prisma.tenant.upsert({
  where: { name: "Main Tenant" },
  update: {},
  create: {
    name: "Main Tenant"
  }
});

  const hash = await bcrypt.hash("test123", 10);

  // 👉 user
  await prisma.user.create({
    data: {
      email: "test@mail.com",
      passwordHash: hash,
      name: "Test User",
      role: "CASHIER",
      tenantId: tenant.id,
      active: true
    }
  });

  // 👉 product
  const product = await prisma.product.create({
    data: {
      name: "Test Product1",
      price: 1000,
      tenantId: tenant.id
    },
  });


  // 👉 inventory
  await prisma.inventory.create({
    data: {
      productId: product.id,
      shopId: shop.id,
      quantity: 10,
    },
  });

  console.log("✅ Seed done");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });