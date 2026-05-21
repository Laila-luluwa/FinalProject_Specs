jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-refresh-token') }));

jest.mock('../../lib/prisma', () => {
  const client = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  };
  return client;
});

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

jest.mock('../../services/email.queue', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../lib/prisma');
const express = require('express');
const request = require('supertest');
const authRouter = require('../../routes/auth');

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

describe('POST /auth/register role assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue({ id: 1, name: 'Acme' });
  });

  test('first user in tenant becomes OWNER', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data })
    );

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Alice', email: 'a@test.com', password: 'secret1', tenantId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('OWNER');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'OWNER', tenantId: 1 }),
      })
    );
  });

  test('second user in tenant becomes VIEWER', async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 2, ...data })
    );

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Bob', email: 'b@test.com', password: 'secret1', tenantId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('VIEWER');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'VIEWER' }),
      })
    );
  });

  test('unknown tenant returns 404', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'X', email: 'x@test.com', password: 'secret1', tenantId: 99 });

    expect(res.status).toBe(404);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
