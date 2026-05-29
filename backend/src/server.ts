import 'dotenv/config';

// Set up global error handlers BEFORE any other imports
// This catches database connection errors that happen during module loading
process.on('unhandledRejection', (reason: any) => {
  const errMessage = reason?.message || String(reason);
  const errCode = reason?.code || '';

  // Check if this is a database connection error
  const isDbError =
    errCode === 'ETIMEDOUT' ||
    errCode === 'ENETUNREACH' ||
    errCode === 'ECONNREFUSED' ||
    errMessage.includes('Connection terminated') ||
    errMessage.includes('connection') ||
    errMessage.includes('timeout');

  if (isDbError) {
    console.warn('Database connection error - server will continue without PostgreSQL features');
    return;
  }

  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err: Error) => {
  const errMessage = err?.message || '';
  const errCode = (err as any)?.code || '';

  // Check if this is a database connection error
  const isDbError =
    errCode === 'ETIMEDOUT' ||
    errCode === 'ENETUNREACH' ||
    errCode === 'ECONNREFUSED' ||
    errMessage.includes('Connection terminated') ||
    errMessage.includes('connection') ||
    errMessage.includes('timeout');

  if (isDbError) {
    console.warn('Database connection error - server will continue without PostgreSQL features');
    return;
  }

  console.error('Uncaught Exception:', err);
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';

import { initializeApp } from './init';
import { errorHandler } from './middleware/errorHandler';
import { logRequest } from './middleware/auth';
import { securityMiddleware, rootPathLimiter } from './middleware/security';
import { logger } from './utils/logger';
import routes from './routes';
import startupService from './services/startup.service';

// Initialize app with Socket.IO
initializeApp().then(({ app, httpServer }) => {
  // Health check endpoint - MUST be first to respond even during cold starts
  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.head('/', (_req, res) => {
    res.status(200).end();
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'Famous Gates API',
      status: 'ok',
      health: '/health'
    });
  });

  app.get(['/favicon.ico', '/favicon.png', '/robots.txt'], (_req, res) => {
    res.status(204).end();
  });

  // Trust proxy (required for Render/Heroku/Railway behind load balancer)
  app.set('trust proxy', 1);

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS configuration - MUST be before all other middleware
  const allowedOrigins = [
    'https://famousgate.hirall.com',
    'https://api.hirall.com',
    'https://services.hirall.com',
    'https://famousgatehotels.com',
    'https://www.famousgatehotels.com'
  ];

  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Check exact matches
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow any subdomain of hirall.com (case-insensitive)
      if (/^https:\/\/([a-z0-9-]+\.)*hirall\.com$/i.test(origin)) {
        return callback(null, true);
      }

      // Development only - allow localhost
      if (process.env.NODE_ENV !== 'production') {
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
          return callback(null, true);
        }
      }

      // Allow Electron custom protocols
      if (/^(pos|app):\/\//i.test(origin)) {
        return callback(null, true);
      }

      // Reject all others
      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error('CORS not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Branch-ID', 'X-Request-Time', 'x-request-time', 'Cache-Control', 'Pragma', 'Expires'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600 // Cache preflight for 10 minutes
  };

  // Apply CORS to all routes
  app.use(cors(corsOptions));

  // Explicitly handle OPTIONS preflight with same config
  app.options('*', cors(corsOptions));

  // Relaxed Helmet for development
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false // Disable CSP for development
  }));

  app.use(morgan('dev'));

  // Security middleware - block vulnerability scanners
  app.use(securityMiddleware);
  app.use(rootPathLimiter);

  app.use(logRequest);

  // Static files
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Rate limiting - aggressive for auth and financial endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per 15 minutes
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const financialLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many requests to financial endpoints',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiters to specific routes
  app.use('/api/auth', authLimiter);
  app.use('/api/payment', financialLimiter);
  app.use('/api/accounting', financialLimiter);
  app.use('/api/finance', financialLimiter);
  app.use('/api/cashier', financialLimiter);
  app.use(generalLimiter);

  // API routes
  app.use('/api', routes);

  // Error handling with CORS headers (ensures CORS works even on errors)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    errorHandler(err, req, res, next);
  });

  // Handle unhandled routes
  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });
  logger.info('Starting server initialization...');

  // Log environment variables (excluding sensitive data)
  logger.debug('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    FRONTEND_URL: process.env.FRONTEND_URL
  });

  logger.info('App initialized successfully');
  // Start server
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, async () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    logger.info(`Health check available at http://localhost:${PORT}/health`);

    // Connect to database in the background (prevents health check timeout)
    import('./config/database').then(({ connectDB }) => {
      connectDB()
        .then(() => logger.info('Database background connection verified'))
        .catch((err: any) => logger.error('Database background connection failed:', err));
    });

    // Initialize startup services
    await startupService.initialize();
  });

  // Note: Global error handlers are set up at the top of this file
  // before any imports to catch database connection errors early

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully');
    httpServer.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  });
}).catch(error => {
  logger.error('Failed to start server');
  if (error instanceof Error) {
    logger.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  } else {
    logger.error('Unknown error:', error);
  }
  process.exit(1);
});
