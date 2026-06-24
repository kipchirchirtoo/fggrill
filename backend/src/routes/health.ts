import { Router, Request, Response } from 'express';
import { pingRedis } from '../config/redis';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Enterprise health check endpoint for Render zero-downtime deploys.
 *
 * Returns 200 if all services are up, 503 if degraded.
 * Render uses this for automatic restarts on failure.
 *
 * Mounted at GET /health (BEFORE rate limiters so health checks are never limited).
 */

const router = Router();

// Read version from package.json at startup
let appVersion = '0.0.0';
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    appVersion = require('../../package.json').version;
} catch {
    // Fallback if package.json is not accessible
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
    const services: Record<string, 'up' | 'down'> = {
        redis: 'down',
        database: 'down',
    };

    // Check Redis
    try {
        const redisOk = await pingRedis();
        services.redis = redisOk ? 'up' : 'down';
    } catch {
        services.redis = 'down';
    }

    // Check Supabase (simple query)
    try {
        const { error } = await supabase.from('branches').select('id').limit(1);
        services.database = error ? 'down' : 'up';
    } catch {
        services.database = 'down';
    }

    const allUp = Object.values(services).every((s) => s === 'up');
    const status = allUp ? 'ok' : 'degraded';
    const statusCode = allUp ? 200 : 503;

    if (!allUp) {
        logger.warn('Health check degraded:', services);
    }

    res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: appVersion,
        services,
    });
});

export default router;
