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
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS configuration - allow all localhost/127.0.0.1 origins in development
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      // Allow specific origins
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'https://famousgate.hirall.com',
        'https://api.hirall.com',
        'https://services.hirall.com'
      ];

      // Add FRONTEND_URL from env if it exists
      if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow all localhost and 127.0.0.1 origins (any port)
      if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
        return callback(null, true);
      }

      // Allow any subdomain of hirall.com
      if (origin.match(/^https:\/\/([a-z0-9-]+\.)*hirall\.com$/)) {
        return callback(null, true);
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Branch-ID']
  }));

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

  // Rate limiting - relaxed for development
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000 // limit each IP to 1000 requests per minute
  });
  app.use(limiter);

  // API routes
  app.use('/api', routes);

  // Error handling
  app.use(errorHandler);

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
    logger.info(`Health check available at http://localhost:${PORT}/api/health`);

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
