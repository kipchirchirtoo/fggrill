import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// List of suspicious paths that indicate security scanning
const SUSPICIOUS_PATTERNS = [
    /\.env/i,
    /\.git/i,
    /\.php$/i,
    /wp-content/i,
    /wp-admin/i,
    /phpinfo/i,
    /config.*database/i,
    /\.sql$/i,
    /\.bak$/i,
    /\.old$/i,
    /backup/i,
    /admin\.php/i,
    /shell/i,
    /\.xml$/i,
    /\.yml$/i,
    /\.yaml$/i
];

/**
 * Security middleware to block common vulnerability scanning attempts
 * Reduces log noise and prevents information disclosure
 */
export const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const path = req.path.toLowerCase();

    // Check if the path matches any suspicious pattern
    const isSuspicious = SUSPICIOUS_PATTERNS.some(pattern => pattern.test(path));

    if (isSuspicious) {
        // Log security scan attempt (at debug level to reduce noise)
        logger.debug(`Blocked security scan attempt: ${req.method} ${req.path} from ${req.ip}`);

        // Return 404 without revealing any information
        // Don't use 403 as it confirms the path exists
        return res.status(404).send('Not Found');
    }

    next();
};

/**
 * Rate limiting for root path to prevent spam
 */
const rootPathAttempts = new Map<string, { count: number; resetTime: number }>();

export const rootPathLimiter = (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' && req.method === 'GET') {
        const ip = req.ip || 'unknown';
        const now = Date.now();
        const limit = rootPathAttempts.get(ip);

        if (limit) {
            if (now < limit.resetTime) {
                if (limit.count >= 5) {
                    // Too many requests
                    return res.status(429).send('Too Many Requests');
                }
                limit.count++;
            } else {
                // Reset counter
                rootPathAttempts.set(ip, { count: 1, resetTime: now + 60000 }); // 1 minute window
            }
        } else {
            rootPathAttempts.set(ip, { count: 1, resetTime: now + 60000 });
        }
    }

    next();
};
