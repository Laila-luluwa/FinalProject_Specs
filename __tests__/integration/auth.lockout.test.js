const request = require('supertest');
const app = require('../../app.test');
const { prisma, resetDatabase } = require('../../lib/test-db');

describe('Account Lockout Flow (Integration)', () => {
  
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should lock account after 5 failed attempts', async () => {
    // Create user first
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'correct-horse-battery-staple',
        name: 'Test User'
      });

    // 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password'
        });
      
      if (i < 4) {
        expect(res.status).toBe(401);
        expect(res.body.attemptsRemaining).toBe(4 - i);
      } else {
        // 5th attempt locks account
        expect(res.status).toBe(423);
        expect(res.body.error).toContain('locked');
      }
    }
  });

  test('should reject correct password during lockout', async () => {
    // Setup: Create user and lock account
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'locked@example.com',
        password: 'correct-horse-battery-staple',
        name: 'Locked User'
      });

    // Lock the account
for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'locked@example.com', password: 'wrong' });
    }

    // Try correct password while locked
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'locked@example.com',
        password: 'correct-horse-battery-staple'
      });

    expect(res.status).toBe(423);
    expect(res.body.retryAfter).toBeDefined();
  });

  test('should reset failed count on successful login', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'reset@example.com',
        password: 'correct-horse-battery-staple',
        name: 'Reset User'
      });

    // 2 failed attempts
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'wrong1' });
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'wrong2' });

    // Successful login
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'reset@example.com',
        password: 'correct-horse-battery-staple'
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    // Verify DB reset (check next login attempt has full 5 tries)
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'wrong' });
    expect(res2.body.attemptsRemaining).toBe(4); // Reset to 5-1=4
  });
});
