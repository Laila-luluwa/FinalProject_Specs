const express = require('express');
const router = express.Router();

const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const { parsePagination, paginatedResponse } = require('../lib/pagination');

router.get(
  '/',
  requireAuth,
  requireRole(['OWNER', 'AUDITOR']),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query);
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip,
          take: limit,
          orderBy: { timestamp: 'desc' },
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        }),
        prisma.auditLog.count(),
      ]);

      res.json(paginatedResponse(logs, total, page, limit));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;