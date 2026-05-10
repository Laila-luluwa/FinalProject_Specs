const request = require('supertest');
const app = require('../../app.test');
const { prisma, resetDatabase } = require('../../lib/test-db');

describe('API Key Lifecycle (Integration)', () => {
  let authToken;
  let apiKey;

  beforeEach(async () => {
    await resetDatabase();
    
    // Setup: Register and login to get JWT
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'dev@example.com',
        password: 'correct-horse-battery-staple',
        name: 'API Dev'
      });

    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'dev@example.com',
        password: 'correct-horse-battery-staple'
      });
    
    authToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should create API key with JWT', async () => {
    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Key', plan: 'free' });

    expect(res.status).toBe(201);
    expect(res.body.apiKey).toBeDefined();
    expect(res.body.apiKey).toContain('ak_live_');
    expect(res.body.monthlyQuota).toBe(100);
    
    apiKey = res.body.apiKey; // Save for next test
  });

  test('should access protected endpoint with valid API key', async () => {
    // Create key first
    const keyRes = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ plan: 'free' });
const key = keyRes.body.apiKey;

    // Use key to access weather endpoint
    const res = await request(app)
      .get('/api/v1/weather')
      .set('X-API-Key', key);

    expect(res.status).toBe(200);
    expect(res.body.temperature).toBeDefined();
    expect(res.body.requestsRemaining).toBe(99); // Used 1 of 100
  });

  test('should reject revoked API key', async () => {
    // Create key
    const keyRes = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ plan: 'free' });
    
    const keyId = keyRes.body.id; // Assuming your API returns ID
    const key = keyRes.body.apiKey;

    // Revoke it (assuming you have a revoke endpoint from Part 5)
    await request(app)
      .delete(`/api/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${authToken}`);

    // Try to use revoked key
    const res = await request(app)
      .get('/api/v1/weather')
      .set('X-API-Key', key);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('revoked');
  });

  test('should enforce quota limits', async () => {
    // Create key with small quota for testing
    const keyRes = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ plan: 'free' }); // 100 requests
    
    const key = keyRes.body.apiKey;

    // Exhaust quota (100 calls)
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/v1/weather').set('X-API-Key', key);
    }

    // 101st call should fail
    const res = await request(app)
      .get('/api/v1/weather')
      .set('X-API-Key', key);

    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Quota exceeded');
  });
});
