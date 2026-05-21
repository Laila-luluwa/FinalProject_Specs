const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { getEmailQueueStats } = require('../services/email.queue');
const {
  getDeadStockQueueStats,
  triggerDeadStockNow,
} = require('../services/background.queue');

router.get(
  '/queues',
  requireAuth,
  requireRole(['OWNER', 'MANAGER']),
  async (req, res, next) => {
    try {
      const [email, deadStock] = await Promise.all([
        getEmailQueueStats(),
        getDeadStockQueueStats(),
      ]);
      res.json({
        email,
        deadStock,
        schedules: {
          deadStockDecay: 'Every 60 minutes (BullMQ repeatable job)',
          emailProcessing: 'On-demand via BullMQ email queue',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

async function deadStockTriggerHandler(req, res, next) {
  try {
    const job = await triggerDeadStockNow();
    res.status(202).json({
      message: 'Dead stock decay job queued',
      jobId: job.id,
    });
  } catch (err) {
    next(err);
  }
}

router.post(
  '/dead-stock/trigger',
  requireAuth,
  requireRole(['OWNER', 'MANAGER']),
  deadStockTriggerHandler
);

/** Alias for frontend */
router.post(
  '/trigger-dead-stock',
  requireAuth,
  requireRole(['OWNER', 'MANAGER']),
  deadStockTriggerHandler
);

router.get(
  '/email-queue-stats',
  requireAuth,
  requireRole(['OWNER', 'MANAGER']),
  async (req, res, next) => {
    try {
      const stats = await getEmailQueueStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
