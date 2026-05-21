const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function disconnectPrisma() {
  await prisma.$disconnect();
}

module.exports = prisma;
module.exports.disconnectPrisma = disconnectPrisma;
