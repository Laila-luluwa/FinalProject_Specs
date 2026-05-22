const { validateEnv } = require('./lib/config/env');
const { verifySmtpConnection } = require('./lib/mail');
validateEnv();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');
const { disconnectPrisma } = require('./lib/prisma');

require('./services/email.queue');
const { scheduleDeadStockCron } = require('./services/background.queue');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/order.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const { requireAuth } = require('./middleware/auth');
const { requireRole } = require('./middleware/role');
const productRoutes = require('./routes/products.routes');
const auditRoutes = require('./routes/audit');
const jobsRoutes = require('./routes/jobs.routes');
const oauthRoutes = require('./routes/oauth');
const usersRoutes = require('./routes/users');
const uploadsRoutes = require('./routes/uploads');
const apiKeyRoutes = require('./routes/apiKeys');
const tenantRoutes = require('./routes/tenant.routes');


const PORT = Number(process.env.PORT) || 3000;

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && allowedOrigins.includes('*')) {
  throw new Error('FATAL: Wildcard CORS is not allowed in production');
}

app.use(express.json());
app.use(cookieParser());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      // Required for onclick="switchTab('register')" etc. in index.html (CSP3 script-src-attr)
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:5173', 'https:'],
    },
  },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
}));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`CORS blocked: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400,
}));


app.use('/tenants', tenantRoutes);

app.use('/api', apiLimiter);

app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);
app.use('/inventory', inventoryRoutes);
/** Тот же функционал, что POST /inventory/transfer — явный короткий путь для Postman/Swagger */
app.post('/transfer', requireAuth, requireRole('MANAGER'), inventoryRoutes.stockTransferHandler);
app.use('/products', productRoutes);
app.use('/audit-logs', auditRoutes);
app.use('/api/jobs', jobsRoutes);

app.use('/api/auth', oauthRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/api-keys', apiKeyRoutes);

app.get('/api', (req, res) => {
  res.json({
    service: 'LeanStock API',
    version: '2.0.0',
    docs: '/docs',
    health: '/api/status',
    transfer: 'POST /transfer (alias) or POST /inventory/transfer',
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/api/status', async (req, res) => {
  const { smtpConfigured } = require('./lib/mail');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    smtp: smtpConfigured() ? 'configured' : 'missing',
    emailMode: process.env.RENDER === 'true' || process.env.NODE_ENV === 'production' ? 'direct-smtp' : 'auto',
  });
});

app.use(express.static(path.join(__dirname, 'frontend')));

const swaggerDocument = YAML.load('./openapi.yaml');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(errorHandler);

let server;

async function start() {
  const redisHint = process.env.REDIS_URL?.trim()
    ? 'set (rediss/redis URL)'
    : 'MISSING — queues disabled';
  console.log(
    `[Boot] NODE_ENV=${process.env.NODE_ENV || 'undefined'} PORT=${PORT} REDIS_URL=${redisHint} RENDER=${process.env.RENDER || 'false'}`
  );

  // Render requires binding 0.0.0.0:PORT before health check; do not block on Redis first.
  const host = process.env.HOST || '0.0.0.0';
  await new Promise((resolve, reject) => {
    server = app.listen(PORT, host, () => {
      console.log(`Server running on http://${host}:${PORT}`);
      console.log(`API docs: http://${host}:${PORT}/docs`);
      resolve();
    });
    server.on('error', reject);
  });

  verifySmtpConnection().catch(() => {});

  if (process.env.SKIP_REDIS_QUEUES !== '1') {
    scheduleDeadStockCron().catch((err) => {
      console.error('[DeadStock] Cron schedule failed (check REDIS_URL):', err.message);
    });
  } else {
    console.log('[DeadStock] Queues skipped (SKIP_REDIS_QUEUES=1)');
  }
}

async function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectPrisma();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
}

module.exports = app;
