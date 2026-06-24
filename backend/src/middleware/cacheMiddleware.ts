import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService';
import { logger } from '../utils/logger';

/**
 * Redis-backed response caching middleware for FamousGate Hotels API.
 *
 * Usage:
 *   import { withCache } from '../middleware/cacheMiddleware';
 *   import { CacheKeys, CACHE_TTL } from '../services/cacheService';
 *
 *   router.get('/items',
 *     withCache(req => CacheKeys.menu(Number(req.query.branch_id)), CACHE_TTL.MENU),
 *     getMenuItems
 *   );
 *
 * Behavior:
 * - Only caches GET requests
 * - Only caches 2xx responses
 * - Returns X-Cache: HIT/MISS, X-Cache-Key, X-Cache-Age headers
 * - If Redis is down, request passes through uncached (fail-open)
 * - skipCache option allows bypassing cache for admin/debug routes
 */

interface WithCacheOptions {
    /** If this returns true, skip cache entirely (e.g. admin routes needing fresh data) */
    skipCache?: (req: Request) => boolean;
}

export function withCache(
    keyFn: string | ((req: Request) => string),
    ttl?: number,
    options?: WithCacheOptions
) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            next();
            return;
        }

        // Allow caller to skip cache conditionally
        if (options?.skipCache?.(req)) {
            next();
            return;
        }

        const key = typeof keyFn === 'function' ? keyFn(req) : keyFn;

        try {
            // Check Redis for cached response
            const cached = await cacheService.getWithMeta<unknown>(key);

            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Key', key);
                res.setHeader('X-Cache-Age', cached.age);
                res.status(200).json(cached.value);
                return;
            }
        } catch (err) {
            // Redis error — skip cache, proceed normally
            logger.warn(`Cache middleware GET error for "${key}":`, (err as Error).message);
        }

        // Cache MISS — intercept res.json() to store the response
        const originalJson = res.json.bind(res);
        res.json = (body: unknown): Response => {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Fire-and-forget — don't block the response
                cacheService.setWithMeta(key, body, ttl).catch((err) => {
                    logger.warn(`Cache middleware SET error for "${key}":`, (err as Error).message);
                });
            }

            res.setHeader('X-Cache', 'MISS');
            res.setHeader('X-Cache-Key', key);
            return originalJson(body);
        };

        next();
    };
}
