const { Queue, Worker } = require('bullmq');
const { applyDiscounts } = require('./deadStock.service');
const { getRedisConnection } = require('../lib/redis');

const redisConnection = getRedisConnection();

const deadStockQueue = new Queue('dead-stock', { connection: redisConnection });

const deadStockWorker = new Worker(
  'dead-stock',
  async (job) => {
    const result = await applyDiscounts();
    console.log(`[DeadStock Worker] Job ${job.id} done:`, result);
    return result;
  },
  { connection: redisConnection }
);

deadStockWorker.on('failed', (job, err) => {
  console.error(`[DeadStock Worker] Job ${job?.id} failed:`, err.message);
});

async function scheduleDeadStockCron() {
  await deadStockQueue.add(
    'hourly-decay',
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'dead-stock-hourly',
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
}

async function triggerDeadStockNow() {
  return deadStockQueue.add('manual-decay', { triggeredAt: new Date().toISOString() });
}

async function getDeadStockQueueStats() {
  return deadStockQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
}

module.exports = {
  deadStockQueue,
  deadStockWorker,
  scheduleDeadStockCron,
  triggerDeadStockNow,
  getDeadStockQueueStats,
};
