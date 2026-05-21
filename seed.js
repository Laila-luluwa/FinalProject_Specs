/**
 * Defense demo seed — idempotent, safe to re-run.
 * Run: node seed.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Defense123!';

const USERS = [
  { email: 'manager@defense.local', name: 'Demo Manager', role: 'MANAGER' },
  { email: 'auditor@defense.local', name: 'Demo Auditor', role: 'AUDITOR' },
  { email: 'cashier@defense.local', name: 'Demo Cashier', role: 'CASHIER' },
  { email: 'owner@defense.local', name: 'Demo Owner', role: 'OWNER' },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  let tenant = await prisma.tenant.findFirst({ where: { name: 'Defense Tenant' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { name: 'Defense Tenant' } });
  }

  const shopA = await ensureShop(tenant.id, 'Shop A', 'Almaty Center');
  const shopB = await ensureShop(tenant.id, 'Shop B', 'Almaty South');

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        tenantId: tenant.id,
        passwordHash,
        isVerified: true,
        active: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        tenantId: tenant.id,
        passwordHash,
        isVerified: true,
        active: true,
      },
    });
  }

  let product = await prisma.product.findFirst({
    where: { tenantId: tenant.id, name: 'Defense Demo Product' },
  });
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: 'Defense Demo Product',
        price: 1500,
        tenantId: tenant.id,
      },
    });
  }

  await ensureInventory(product.id, shopA.id, 50);
  await ensureInventory(product.id, shopB.id, 10);

  console.log('\n✅ Defense seed complete\n');
  console.log('Tenant ID:', tenant.id);
  console.log('Shop A ID:', shopA.id, '| Shop B ID:', shopB.id);
  console.log('Product ID:', product.id);
  console.log('Password (all users):', DEMO_PASSWORD);
  console.log('\nUsers:');
  USERS.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
  console.log('\nPostman: import postman/LeanStock-Defense.* and set tenantId, shopId, productId if needed.\n');
}

async function ensureShop(tenantId, name, location) {
  let shop = await prisma.shop.findFirst({ where: { tenantId, name } });
  if (!shop) {
    shop = await prisma.shop.create({ data: { tenantId, name, location } });
  }
  return shop;
}

async function ensureInventory(productId, shopId, quantity) {
  const existing = await prisma.inventory.findUnique({
    where: { productId_shopId: { productId, shopId } },
  });
  if (existing) {
    await prisma.inventory.update({
      where: { id: existing.id },
      data: { quantity },
    });
  } else {
    await prisma.inventory.create({
      data: { productId, shopId, quantity },
    });
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
