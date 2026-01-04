import { Request, Response, NextFunction } from 'express';
import db from '../db';
import { logger } from '../utils/logger';

/**
 * Middleware to log all state-changing requests (POST, PUT, DELETE)
 * to the activity_logs table for audit trail purposes.
 */
export const activityLogger = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    // Only log state-changing methods
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    if (!stateChangingMethods.includes(req.method)) {
        return next();
    }

    // Capture the original end function to log after response is sent
    const originalEnd = res.end;

    // We use a flag to ensure we only log once per request
    let logged = false;

    res.end = function (chunk?: any, encoding?: any, cb?: any): any {
        if (!logged) {
            logged = true;

            // Log after the response is finished
            const userId = req.user?.id;
            const action = `${req.method} ${req.originalUrl}`;
            const method = req.method;
            const path = req.originalUrl;
            const ip = req.ip;
            const userAgent = req.get('User-Agent');

            // Mask sensitive data in payload if it's a login or password update
            let payload = { ...req.body };
            if (path.includes('login') || path.includes('password') || path.includes('register')) {
                if (payload.password) payload.password = '********';
                if (payload.newPassword) payload.newPassword = '********';
                if (payload.oldPassword) payload.oldPassword = '********';
            }

            // Perform logging asynchronously to not block the response
            if (userId) {
                db.query(
                    `INSERT INTO public.activity_logs (user_id, action, method, path, ip, user_agent, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [userId, action, method, path, ip, userAgent, JSON.stringify(payload)]
                ).catch(err => {
                    logger.error('Failed to save activity log:', err);
                });
            }
        }

        return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
};
