import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { User, UserRole } from '../models/User';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Protect routes
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    const isDev = process.env.NODE_ENV !== 'production';

    // In development, if there is no token at all, attach a dev super_admin user
    if (!token && isDev) {
      logger.warn('No auth token provided – using development super_admin user');
      req.user = { id: 'dev-user', role: UserRole.SUPER_ADMIN, branch_id: 1 };
      next();
      return;
    }

    // In non-development environments, token is mandatory
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
      return;
    }

    try {
      // Verify token with Supabase
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !supabaseUser) {
        // In development, fall back to dev user on Supabase auth failure
        if (isDev) {
          logger.warn('Supabase auth failed in development, falling back to dev super_admin user', authError);
          req.user = { id: 'dev-user', role: UserRole.SUPER_ADMIN, branch_id: 1 };
          next();
          return;
        }

        res.status(401).json({
          success: false,
          message: 'Not authorized to access this route'
        });
        return;
      }

      // Get user from database
      const user = await User.findById(supabaseUser.id);
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Not authorized to access this route'
        });
        return;
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      // If Supabase is unreachable in development, fall back to dev user
      if (isDev) {
        logger.warn('Supabase auth threw an error in development, falling back to dev super_admin user', error);
        req.user = { id: 'dev-user', role: UserRole.SUPER_ADMIN };
        next();
        return;
      }

      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
      return;
    }
  } catch (error) {
    next(error);
  }
};

// Grant access to specific roles
export const authorize = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
      return;
    }

    next();
  };
};

// Rate limiting middleware
export const rateLimit = (
  windowMs: number,
  max: number
) => {
  const requests = new Map();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const ip = req.ip;

    // Clear old requests
    requests.forEach((timestamp, key) => {
      if (now - timestamp > windowMs) {
        requests.delete(key);
      }
    });

    // Get requests for this IP
    const requestTimes = requests.get(ip) || [];
    requestTimes.push(now);

    // Remove requests outside window
    while (requestTimes.length > 0 && now - requestTimes[0] > windowMs) {
      requestTimes.shift();
    }

    // Update requests map
    requests.set(ip, requestTimes);

    // Check if limit exceeded
    if (requestTimes.length > max) {
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
      return;
    }

    next();
  };
};

// Log requests
export const logRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.info(`${req.method} ${req.originalUrl} [${req.ip}]`);
  next();
};
