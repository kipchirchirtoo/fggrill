import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
      return;
    }

    // 1. Try Supabase Auth first
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (!error && user) {
        // Add user to request
        req.user = user;
        return next();
      }
    } catch (supabaseError) {
      logger.debug('Supabase token verification failed, trying local fallback');
    }

    // 2. Fallback: Local JWT verification
    const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';

    try {
      const decoded = jwt.verify(token, jwtSecret) as any;

      if (decoded && decoded.sub) {
        // Map local JWT structure to req.user structure
        req.user = {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          app_metadata: {},
          user_metadata: {},
          aud: decoded.aud || 'authenticated',
          created_at: ''
        };
        return next();
      }
    } catch (jwtError) {
      logger.error('Local JWT verification failed:', jwtError);
    }

    res.status(401).json({
      success: false,
      message: 'Not authorized - Invalid or expired token'
    });
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

export const authorize = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', req.user?.id)
        .single();

      if (error || !profile) {
        res.status(401).json({
          success: false,
          message: 'Not authorized to access this route'
        });
        return;
      }

      if (!roles.includes(profile.role)) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to access this route'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  };
};
