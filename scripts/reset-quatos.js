// File: scripts/reset-quotas.js
const prisma = require('../lib/prisma');

async function reset() {
    await prisma.apiKey.updateMany({
        data: { requestsThisMonth: 0 }
    });
    console.log('Quotas reset');
    process.exit(0);
}

reset();
