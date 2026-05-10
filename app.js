const express = require('express');
const app = express();
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middleware/errorHandler');
const orderRoutes = require("./routes/order.routes");
const prisma = require("./lib/prisma");



const authRoutes = require('./routes/auth');
const { apiLimiter } = require('./middleware/rateLimit');
const inventoryRoutes = require("./routes/inventory.routes");
const { applyDiscounts } = require("./services/deadStock.service");
const productRoutes = require('./routes/products.routes');







// ==================== CONFIG ====================
const PORT = 3000;

app.use(express.json());
app.use(helmet());
app.use(cookieParser());

app.use("/orders", orderRoutes);
app.use("/inventory", inventoryRoutes);
app.use('/products', productRoutes);
app.use('/auth', authRoutes);




// ==================== MIDDLEWARE ====================
app.use((req, res, next) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.originalUrl}`);
    next();
});

// Security headers middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Allow inline styles if needed
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:5173']
    }
  },
  hsts: {
    maxAge: 31536000,  // 1 year HTTPS enforcement
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' }
}));

// Custom headers for API
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');  // Prevent clickjacking
  res.setHeader('X-XSS-Protection', '0');  // Disabled in favor of CSP
  next();
});

// Whitelist allowed origins
const allowedOrigins = [
  'http://localhost:5173',  // Your frontend dev server
  'http://localhost:3000',
  'https://your-production-app.com'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,  // Allow cookies
  maxAge: 86400  // Cache preflight for 24 hours
};

app.use(cors(corsOptions));

// ==================== ROUTES ====================
const oauthRoutes = require('./routes/oauth');
const usersRoutes = require('./routes/users');
const uploadsRoutes = require('./routes/uploads');
const apiKeyRoutes = require('./routes/apiKeys');


//const { authLimiter, apiLimiter } = require('./middleware/rateLimit');

app.use('/api/auth', oauthRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/api-keys', apiKeyRoutes);


// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        service: 'Node.js Backend with PostgreSQL',
        version: '2.0.0',
        endpoints: [
            '/api/users',
            '/api/users/:id',
            '/api/users/search'
        ]
    });
});

// ==================== HEALTH ====================
app.get('/api/status', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

app.use((err, req, res, next) => {
  console.error("ERROR:", err.code, err.message);

  // ✅ CSRF
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Invalid CSRF token'
    });
  }

  // ✅ CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS blocked'
    });
  }

  // 🔥 остальное
  return res.status(500).json({
    error: 'Server error'
  });
});

setInterval(() => {
  applyDiscounts();
}, 1000 * 60 * 60); // каждый час

app.get("/products", async (req, res) => {
  const data = await prisma.product.findMany();
  res.json(data);
});

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// загружаем твой YAML файл
const swaggerDocument = YAML.load('./openapi.yaml');

// подключаем swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ==================== START ====================
console.log("ROUTES LOADED");
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});