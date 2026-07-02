import { Ratelimit } from '@upstash/ratelimit';
import { Request, Response, NextFunction } from 'express';
import { upstashRedis } from '../config/redis';
import { logger } from '../utils/logger';

const redisRateLimitEnabled = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);
let warnedRedisDisabled = false;

/**
 * Enterprise-grade rate limiting for FamousGate Hotels API.
 *
 * Uses Upstash Ratelimit with Sliding Window algorithm (same as Stripe).
 * All limiters fail-open: if Redis is down, requests pass through with
 * a warning log rather than taking down the API.
 *
 * NOTE: app.set('trust proxy', 1) must be set in the main app file
 * BEFORE mounting these middleware.
 */

// ── Identifier extraction ──────────────────────────────────────────────────────

function getClientIp(req: Request): string {
    return (
        req.ip ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown'
    );
}

function getBranchIdentifier(req: Request): string {
    // POS terminals on hotel LAN share IPs, so we rate-limit by branch_id
    const branchId = req.headers['x-branch-id'] as string | undefined;
    if (branchId) return `branch:${branchId}`;
    return getClientIp(req);
}

// ── Ratelimit instances (Sliding Window) ───────────────────────────────────────

const globalRatelimit = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(500, '15 m'),
    prefix: 'fg:rl:global',
    analytics: true,
});

const authRatelimit = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(20, '5 m'),
    prefix: 'fg:rl:auth',
    analytics: true,
});

const posRatelimit = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(300, '5 m'),
    prefix: 'fg:rl:pos',
    analytics: true,
});

const healthRefreshRatelimit = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(1, '5 m'),
    prefix: 'fg:rl:health-refresh',
    analytics: true,
});

// ── Middleware factory ──────────────────────────────────────────────────────────

type IdentifierFn = (req: Request) => string;

function createLimiterMiddleware(
    ratelimit: Ratelimit,
    identifierFn: IdentifierFn,
    limiterName: string
) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!redisRateLimitEnabled) {
            if (!warnedRedisDisabled) {
                warnedRedisDisabled = true;
                logger.warn('Redis rate limiting disabled: UPSTASH_REDIS_REST_URL/TOKEN are not configured.');
            }
            next();
            return;
        }

        try {
            const identifier = identifierFn(req);
            const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

            // Always set rate limit headers
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', reset);

            if (!success) {
                const retryAfter = Math.ceil((reset - Date.now()) / 1000);
                res.setHeader('Retry-After', retryAfter);

                logger.warn(`Rate limit hit [${limiterName}]`, {
                    identifier,
                    branchId: req.headers['x-branch-id'] || null,
                    path: req.path,
                    timestamp: new Date().toISOString(),
                });

                res.status(429).json({
                    success: false,
                    message: 'Too many requests. Please try again later.',
                    retryAfter,
                });
                return;
            }

            next();
        } catch (err) {
            // FAIL OPEN — if Redis is down, allow the request through
            logger.warn(`Rate limiter [${limiterName}] Redis error — failing open:`, (err as Error).message);
            next();
        }
    };
}

// ── Exported middleware ─────────────────────────────────────────────────────────

/**
 * Global limiter — applied to ALL routes.
 * 500 requests per 15 minutes per IP (Sliding Window).
 */
export const globalLimiter = createLimiterMiddleware(
    globalRatelimit,
    getClientIp,
    'global'
);

/**
 * Auth limiter — applied to /api/auth/* routes.
 * 20 requests per 5 minutes per IP (brute-force protection).
 */
export const authLimiter = createLimiterMiddleware(
    authRatelimit,
    getClientIp,
    'auth'
);

/**
 * POS limiter — applied to /api/pos/* and /api/orders/* routes.
 * 300 requests per 5 minutes per BRANCH (not IP — POS terminals share LANs).
 */
export const posLimiter = createLimiterMiddleware(
    posRatelimit,
    getBranchIdentifier,
    'pos'
);

/**
 * Branch health-check refresh limiter — 1 forced refresh per branch per
 * 5 minutes. Each refresh triggers a Claude API call, so this caps AI spend.
 * Keyed by the :branchId route param (available because this is mounted as
 * route-level middleware on the matched route).
 */
export const healthRefreshLimiter = createLimiterMiddleware(
    healthRefreshRatelimit,
    (req) => `health:branch:${req.params.branchId ?? getBranchIdentifier(req)}`,
    'health-refresh'
);

/**
 * Same limiter, but only when the request explicitly forces a refresh
 * (GET /health-check?force_refresh=true). Cached reads pass through freely.
 */
export const healthRefreshLimiterIfForced = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (req.query.force_refresh === 'true') {
        void healthRefreshLimiter(req, res, next);
        return;
    }
    next();
};
