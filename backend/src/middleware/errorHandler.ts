import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ApiError extends Error {
  statusCode?: number;
  errors?: any[];
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Default error status and message
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Handle different types of errors
  switch (err.code) {
    // Supabase duplicate key error
    case '23505':
      res.status(400).json({
        success: false,
        message: 'Duplicate field value entered',
        error: err.message
      });
      break;

    // Supabase error
    case 'PostgrestError':
      res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: err.errors
      });
      break;

    // JWT errors
    case 'TokenExpiredError':
      res.status(401).json({
        success: false,
        message: 'Token expired',
        error: err.message
      });
      break;

    case 'JsonWebTokenError':
      res.status(401).json({
        success: false,
        message: 'Invalid token',
        error: err.message
      });
      break;

    // Default error response
    default:
      res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
  }
};
