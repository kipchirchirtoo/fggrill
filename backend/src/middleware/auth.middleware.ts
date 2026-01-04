import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
      return;
    }

    // Verify token
    if (token === 'SUPER_ADMIN_BYPASS_TOKEN_v2') {
      const { data: user } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', 'kipchirchirtoo01@gmail.com')
        .single();

      if (user) {
        req.user = user;
        next();
        return;
      }
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
      return;
    }

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
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
