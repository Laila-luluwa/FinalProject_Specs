const { requireRole } = require('../middleware/role');

describe('RBAC Middleware', () => {

  test('OWNER should access OWNER route', () => {
    const middleware = requireRole('OWNER');

    const req = {
      user: { role: 'OWNER' }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('VIEWER should be denied OWNER route', () => {
    const middleware = requireRole('OWNER');

    const req = {
      user: { role: 'VIEWER' }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

});