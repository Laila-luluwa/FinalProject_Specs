// const { PrismaClient } = require('@prisma/client');

// const prisma = new PrismaClient({
//     log: ['query', 'info', 'warn', 'error']
// });

// module.exports = prisma;
// const { PrismaClient } = require('@prisma/client');

// const prisma = new PrismaClient({
//   datasources: {
//     db: {
//       url: process.env.DATABASE_URL
//     }
//   }
// });

// module.exports = prisma;
const { PrismaClient } = require("@prisma/client");

console.log("DATABASE_URL:", process.env.DATABASE_URL);

const prisma = new PrismaClient();

module.exports = prisma;