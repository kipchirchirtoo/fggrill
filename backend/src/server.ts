import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';

import { initializeApp } from './init';
import { errorHandler } from './middleware/errorHandler';
import { logRequest } from './middleware/auth';
import { logger } from './utils/logger';
import routes from './routes';
import { automationService } from './services/automation.service';

// Initialize app with Socket.IO
initializeApp().then(({ app, httpServer }) => {
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Relaxed CORS for development
  app.use(cors({
    origin: true, // Allow all origins temporarily for debugging
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
  
  // Relaxed Helmet for development
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false // Disable CSP for development
  }));
  
  app.use(morgan('dev'));
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
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    logger.info(`Health check available at http://localhost:${PORT}/api/health`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err: Error) => {
    logger.error('Unhandled Rejection:', err);
    // Close server & exit process
    httpServer.close(() => process.exit(1));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception:', err);
    // Close server & exit process
    httpServer.close(() => process.exit(1));
  });

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
