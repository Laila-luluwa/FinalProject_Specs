const { Queue } = require('bullmq');
const { getRedisConnection } = require('../../lib/redis');

describe('Email queue integration', () => {
  let queue;

  beforeAll(() => {
    queue = new Queue('email-test', { connection: getRedisConnection() });
  });

  afterAll(async () => {
    await queue.close();
  });

  test('enqueues a job without blocking', async () => {
    const job = await queue.add(
      'send',
      { to: 'test@example.com', subject: 'Test', html: '<p>Test</p>' },
      { removeOnComplete: true }
    );
    expect(job.id).toBeDefined();
    const counts = await queue.getJobCounts('waiting', 'active', 'completed');
    expect(counts).toHaveProperty('waiting');
  });
});
