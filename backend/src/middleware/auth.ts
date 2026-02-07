import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../config/database';
import { User, UserRole } from '../models/User';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

// Re-export UserRole for convenience
export { UserRole };

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Protect routes - Production-ready authentication
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    // Token is mandatory - no dev fallbacks
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized - no token provided'
      });
      return;
    }

    try {
      // First try to verify as our custom JWT token
      const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';

      try {
        const decoded = jwt.verify(token, jwtSecret) as any;

        if (!decoded || !decoded.sub) {
          logger.error('Auth Middleware - JWT decoded but missing sub', { decoded });
          throw new jwt.JsonWebTokenError('Invalid token payload');
        }

        logger.debug('Auth Middleware - JWT verified for sub:', decoded.sub);

        // Valid JWT - get user from database
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', decoded.sub)
          .single();

        if (userError || !user) {
          logger.error('Auth Middleware - User lookup failed for valid JWT', {
            userId: decoded.sub,
            error: userError?.message || 'User not found'
          });
          // Fallback to Supabase auth in case they used a Supabase token
        } else {
          req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            branch_id: user.branch_id,
            branchId: user.branch_id,
            first_name: user.first_name,
            last_name: user.last_name,
            is_central: !user.branch_id
          };
          next();
          return;
        }
      } catch (jwtError: any) {
        logger.info('Auth Middleware - Custom JWT verification skipped or failed, trying Supabase auth', {
          error: jwtError.message,
          tokenPrefix: token.substring(0, 10)
        });
        // JWT verification failed, try Supabase auth
      }

      // Try Supabase auth as fallback
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !supabaseUser) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
        return;
      }

      // Get user from database
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (!user || userError) {
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Add user to request object
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        branchId: user.branch_id,
        first_name: user.first_name,
        last_name: user.last_name,
        is_central: !user.branch_id
      };
      next();
    } catch (error) {
      logger.error('Auth middleware error:', error);
      res.status(401).json({
        success: false,
        message: 'Authentication failed'
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

    const userRole = String(req.user.role).toLowerCase();
    const allowedRoles = roles.map(r => String(r).toLowerCase());

    if (!allowedRoles.includes(userRole)) {
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
