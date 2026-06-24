import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Redis configuration for FamousGate Hotels API.
 *
 * Two clients are exported:
 *   1. `upstashRedis` — @upstash/redis (REST-based, used by @upstash/ratelimit)
 *   2. `ioredisClient` — ioredis (TCP, used for caching via SCAN/SET/GET)
 *
 * HOW TO SET UP (Upstash free tier):
 *   1. Go to https://console.upstash.com
 *   2. Create a new Redis database (free tier: 10k commands/day)
 *   3. In the database dashboard, go to the "REST API" tab
 *   4. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 *   5. Add them to Render environment variables
 *
 * For ioredis (TCP connection), use the "Details" tab:
 *   Copy the connection string as REDIS_URL (redis://default:PASSWORD@HOST:PORT)
 */

// ── Upstash REST client (for @upstash/ratelimit) ──────────────────────────────
export const upstashRedis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// ── ioredis TCP client (for caching — faster than REST for high-frequency reads)
let ioredisClient: IORedis | null = null;

export function getIORedisClient(): IORedis | null {
    if (ioredisClient) return ioredisClient;

    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
    if (!redisUrl) {
        logger.warn('REDIS_URL not set — ioredis cache will be disabled (falling through to no-cache)');
        return null;
    }

    try {
        ioredisClient = new IORedis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
                if (times > 5) return null; // Stop retrying after 5 attempts
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
            enableReadyCheck: true,
            connectTimeout: 5000,
            // TLS required for Upstash
            tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        });

        ioredisClient.on('error', (err) => {
            logger.warn('ioredis connection error (non-fatal):', err.message);
        });

        ioredisClient.on('connect', () => {
            logger.info('ioredis connected to Redis');
        });

        // Initiate connection
        ioredisClient.connect().catch(() => {
            // Handled by error event
        });
    } catch (err) {
        logger.warn('Failed to initialize ioredis:', err);
        ioredisClient = null;
    }

    return ioredisClient;
}

// ── Health check ───────────────────────────────────────────────────────────────

/**
 * Ping Redis via Upstash REST client.
 * Returns true if Redis is reachable, false otherwise (never throws).
 */
export async function pingRedis(): Promise<boolean> {
    try {
        const result = await upstashRedis.ping();
        return result === 'PONG';
    } catch {
        return false;
    }
}
