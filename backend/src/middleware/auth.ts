import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../config/database';
import db from '../db';
import { User, UserRole } from '../models/User';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import {
  isManagedSessionActive,
  touchManagedSession
} from '../services/session-registry.service';

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const TRANSIENT_SCHEMA_ERRORS = ['schema cache', 'Retrying', 'PGRST002', 'timeout', 'canceling statement'];

function isTransientSchemaError(err: any): boolean {
  const message = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return TRANSIENT_SCHEMA_ERRORS.some(keyword => message.includes(keyword) || code.includes(keyword.toLowerCase()));
}

async function lookupUserWithRetry(userId: string, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } catch (err: any) {
      if (i < retries && isTransientSchemaError(err)) {
        logger.warn('Auth Middleware - Supabase schema/cache transient error, retrying', {
          userId,
          attempt: i + 1,
          error: err.message,
          code: err.code
        });
        await sleep(250 * (i + 1));
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function lookupUserFallback(userId: string): Promise<any | null> {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    return result.rows[0] || null;
  } catch (err: any) {
    logger.error('Auth Middleware - Direct SQL fallback failed', {
      userId,
      error: err.message
    });
    return null;
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

    // Also allow token as query param for browser-initiated downloads (window.open, <a href>)
    if (!token && req.query.token) {
      token = req.query.token as string;
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
      const candidateSecrets = [
        process.env.JWT_SECRET,
        process.env.SUPABASE_JWT_SECRET
      ]
        .filter((secret, index, arr) => secret && arr.indexOf(secret) === index) as string[];

      if (!candidateSecrets.length) {
        candidateSecrets.push('fallback-secret-key');
      }

      let decoded: any;
      const jwtErrors: string[] = [];

      for (const secret of candidateSecrets) {
        try {
          decoded = jwt.verify(token, secret) as any;
          break;
        } catch (err: any) {
          jwtErrors.push(err.message);
        }
      }

      if (decoded && !decoded.sub) {
        logger.error('Auth Middleware - JWT decoded but missing sub', { decoded });
        jwtErrors.push('Invalid token payload: missing sub');
        decoded = undefined;
      }

      if (decoded?.sub) {
        logger.debug('Auth Middleware - JWT verified for sub:', decoded.sub);

        // Valid JWT - get user from database (with retry + direct SQL fallback)
        let user: any = null;
        let userLookupError: any = null;
        try {
          user = await lookupUserWithRetry(decoded.sub);
        } catch (err: any) {
          userLookupError = err;
          // If Supabase schema cache is failing, bypass PostgREST with direct SQL
          user = await lookupUserFallback(decoded.sub);
        }

        if (!user) {
          logger.error('Auth Middleware - User lookup failed for valid JWT', {
            userId: decoded.sub,
            error: userLookupError?.message || 'User not found'
          });
          // Fallback to Supabase auth in case they used a Supabase token
        } else {
          // Check force_logout_at: reject tokens issued before this timestamp
          if (user.force_logout_at) {
            const tokenIssuedAt = (decoded.iat || 0) * 1000;
            if (new Date(user.force_logout_at).getTime() > tokenIssuedAt) {
              res.status(401).json({ success: false, message: 'Session invalidated by administrator' });
              return;
            }
          }

          if (decoded.sid) {
            const managedSessionState = await isManagedSessionActive(String(decoded.sid), user.id);
            if (managedSessionState === false) {
              res.status(401).json({ success: false, message: 'Session revoked or expired' });
              return;
            }
            if (managedSessionState === true) {
              void touchManagedSession(String(decoded.sid));
            }
          }

          // Base user from DB
          const effectiveRole = decoded.active_role || user.role;
          let effectiveBranchId = (decoded.active_branch_id !== undefined && decoded.active_branch_id !== null)
            ? decoded.active_branch_id
            : user.branch_id;

          // Fallback: if users.branch_id is null, check user_branch_roles for a primary assignment
          if (!effectiveBranchId) {
            try {
              const { data: primaryRole } = await supabase
                .from('user_branch_roles')
                .select('branch_id')
                .eq('user_id', user.id)
                .order('is_primary', { ascending: false })
                .limit(1)
                .single();
              if (primaryRole?.branch_id) effectiveBranchId = primaryRole.branch_id;
            } catch {
              // ignore — effectiveBranchId stays null
            }
          }

          req.user = {
            id: user.id,
            email: user.email,
            role: effectiveRole,
            branch_id: effectiveBranchId,
            branchId: effectiveBranchId,
            first_name: user.first_name,
            last_name: user.last_name,
            is_central: !effectiveBranchId,
            primary_role: user.role,          // always the DB role, for audit
            active_context: !!(decoded.active_role), // flag: user is in switched context
            active_outlet_id: decoded.active_outlet_id || null,
            active_outlet_type: decoded.active_outlet_type || null,
            active_outlet_prefix: decoded.active_outlet_prefix || null,
            is_pos_login: decoded.isPosLogin === true,
            session_id: decoded.sid || null,
            is_impersonation: decoded.impersonation === true,
            impersonation_session_id: decoded.impersonation_session_id || null,
            actual_actor_id: decoded.actual_actor_id || null,
          };
          next();
          return;
        }
      } else {
        logger.debug('Auth Middleware - Custom JWT verification skipped or failed, trying Supabase auth', {
          errors: jwtErrors,
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

      // Get user from database (with retry + direct SQL fallback)
      let user: any = null;
      try {
        user = await lookupUserWithRetry(supabaseUser.id);
      } catch (err: any) {
        user = await lookupUserFallback(supabaseUser.id);
      }

      if (!user) {
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

// Alias for compatibility
export const authenticateToken = protect;

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

    const userRole = String(req.user.role).toLowerCase().trim();
    
    // Global override: Super Admin and Director have universal access
    if (userRole === 'super_admin' || userRole === 'director') {
      return next();
    }

    let allowedRoles = roles.map(r => String(r).toLowerCase().trim());
    
    // DIRECTOR (already handled by global override above, but kept for logic clarity if needed in other roles)
    // or other broad-access roles can be added here.
    
    logger.info(`[RBAC Check] URL: ${req.originalUrl}, User Role: "${userRole}", Allowed: [${allowedRoles.join(', ')}]`);

    if (!allowedRoles.includes(userRole)) {
      logger.error('Authorization failed', {
        userId: req.user.id,
        userRole: `"${userRole}"`,
        userRoleRaw: req.user.role,
        expectedOneOf: allowedRoles,
        url: req.originalUrl
      });
      res.status(403).json({
        success: false,
        message: `[RBAC] 403 Forbidden: ${req.originalUrl} — current user lacks permission (role: ${userRole})`
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
