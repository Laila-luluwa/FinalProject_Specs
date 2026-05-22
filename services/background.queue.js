const { Queue, Worker } = require('bullmq');
const { applyDiscounts } = require('./deadStock.service');
const { getRedisConnection } = require('../lib/redis');

let deadStockQueue;
let deadStockWorker;
let initialized = false;

function initDeadStockQueue() {
  if (initialized) return Boolean(deadStockQueue);
  initialized = true;

  if (process.env.SKIP_REDIS_QUEUES === '1') {
    return false;
  }

  if (!process.env.REDIS_URL?.trim() && process.env.DOCKER_COMPOSE !== '1') {
    console.error('[DeadStock] Disabled — set REDIS_URL (Upstash TCP URL) in Render Environment');
    return false;
  }

  const redisConnection = getRedisConnection();
  if (!redisConnection) return false;
  deadStockQueue = new Queue('dead-stock', { connection: redisConnection });
  deadStockWorker = new Worker(
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
  return true;
}

async function scheduleDeadStockCron() {
  if (!initDeadStockQueue()) return;
  const job = deadStockQueue.add(
    'hourly-decay',
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'dead-stock-hourly',
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
  const timeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 15000;
  await Promise.race([
    job,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Redis/BullMQ timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

async function triggerDeadStockNow() {
  if (!initDeadStockQueue()) {
    throw new Error('REDIS_URL not configured');
  }
  return deadStockQueue.add('manual-decay', { triggeredAt: new Date().toISOString() });
}

async function getDeadStockQueueStats() {
  if (!initDeadStockQueue()) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, disabled: true };
  }
  return deadStockQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
}

module.exports = {
  get deadStockQueue() {
    initDeadStockQueue();
    return deadStockQueue;
  },
  get deadStockWorker() {
    initDeadStockQueue();
    return deadStockWorker;
  },
  scheduleDeadStockCron,
  triggerDeadStockNow,
  getDeadStockQueueStats,
};
