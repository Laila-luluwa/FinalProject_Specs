const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db?mode=memory&cache=shared'  // In-memory SQLite
    }
  }
});

// async function resetDatabase() {
//   // Clean slate for each test
//   await prisma.refreshToken.deleteMany();
//   await prisma.apiKey.deleteMany();
//   await prisma.user.deleteMany();
// }
async function resetDatabase() {
  if (prisma.apiKey) await prisma.apiKey.deleteMany();
  if (prisma.user) await prisma.user.deleteMany();
}

module.exports = { prisma, resetDatabase };
