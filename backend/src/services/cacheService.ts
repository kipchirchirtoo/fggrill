import { getIORedisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Enterprise Redis cache service for FamousGate Hotels API.
 *
 * All operations are fail-safe: if Redis is unavailable, they return
 * null/void without crashing. This ensures the API stays up even if
 * the cache layer is degraded.
 *
 * Uses ioredis (TCP) for caching — faster than REST for high-frequency
 * GET/SET operations.
 *
 * CRITICAL: All branch-specific keys include the branch_id to prevent
 * cross-branch data leaks.
 */

// ── TTL Constants (seconds) ────────────────────────────────────────────────────

export const CACHE_TTL = {
    /** 10 min — menu items rarely change mid-shift */
    MENU: 600,
    /** 2 min — inventory changes with each sale/requisition */
    INVENTORY: 120,
    /** 15 min — branch settings are very stable */
    BRANCH_SETTINGS: 900,
    /** 30 sec — shift data must stay near real-time */
    SHIFT_DATA: 30,
    /** 1 hour — user sessions */
    USER_SESSION: 3600,
    /** 5 min — report data */
    REPORT_DATA: 300,
} as const;

// ── Cache Key Builders (prevents typos and key collisions) ─────────────────────

export const CacheKeys = {
    menu: (branchId: number) => `fg:menu:${branchId}`,
    menuCategory: (branchId: number, category: string) => `fg:menu:${branchId}:${category}`,
    inventory: (branchId: number) => `fg:inventory:${branchId}`,
    inventoryItem: (branchId: number, itemId: string) => `fg:inventory:${branchId}:${itemId}`,
    branchSettings: (branchId: number) => `fg:branch:${branchId}`,
    activeShift: (branchId: number) => `fg:shift:active:${branchId}`,
    userSession: (userId: string) => `fg:session:${userId}`,
    reportData: (branchId: number, date: string) => `fg:report:${branchId}:${date}`,
    barStock: (branchId: number) => `fg:bar:stock:${branchId}`,
    posOutletItems: (branchId: number, outletId: string) => `fg:pos:items:${branchId}:${outletId}`,
} as const;

// ── CacheService Class ─────────────────────────────────────────────────────────

class CacheService {
    /**
     * Get a cached value by key.
     * Returns null on cache miss or Redis failure.
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const client = getIORedisClient();
            if (!client) return null;

            const raw = await client.get(key);
            if (!raw) return null;

            return JSON.parse(raw) as T;
        } catch (err) {
            logger.warn(`Cache GET error for key "${key}":`, (err as Error).message);
            return null;
        }
    }

    /**
     * Store a value in cache with an optional TTL override.
     * Default TTL is 300 seconds (5 minutes).
     */
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        try {
            const client = getIORedisClient();
            if (!client) return;

            const serialized = JSON.stringify(value);
            const effectiveTtl = ttl ?? 300;

            await client.setex(key, effectiveTtl, serialized);
        } catch (err) {
            logger.warn(`Cache SET error for key "${key}":`, (err as Error).message);
        }
    }

    /**
     * Delete a specific cache key.
     */
    async del(key: string): Promise<void> {
        try {
            const client = getIORedisClient();
            if (!client) return;

            await client.del(key);
        } catch (err) {
            logger.warn(`Cache DEL error for key "${key}":`, (err as Error).message);
        }
    }

    /**
     * Delete all keys matching a pattern using Redis SCAN.
     *
     * SCAN is non-blocking (unlike KEYS which blocks the entire Redis server).
     * This is the Shopify/Airbnb standard for production pattern deletion.
     *
     * Example: await cacheService.delPattern('fg:menu:2*')
     *          → deletes all menu cache keys for branch 2
     */
    async delPattern(pattern: string): Promise<void> {
        try {
            const client = getIORedisClient();
            if (!client) return;

            let cursor = '0';
            let totalDeleted = 0;

            do {
                const [nextCursor, keys] = await client.scan(
                    cursor,
                    'MATCH', pattern,
                    'COUNT', 100
                );
                cursor = nextCursor;

                if (keys.length > 0) {
                    await client.del(...keys);
                    totalDeleted += keys.length;
                }
            } while (cursor !== '0');

            if (totalDeleted > 0) {
                logger.info(`Cache SCAN+DEL: removed ${totalDeleted} keys matching "${pattern}"`);
            }
        } catch (err) {
            logger.warn(`Cache delPattern error for "${pattern}":`, (err as Error).message);
        }
    }

    /**
     * Get a value with metadata (for cache headers).
     * Returns the value, TTL remaining, and timestamp when it was cached.
     */
    async getWithMeta<T>(key: string): Promise<{ value: T; age: number } | null> {
        try {
            const client = getIORedisClient();
            if (!client) return null;

            const [raw, ttl] = await Promise.all([
                client.get(key),
                client.ttl(key),
            ]);
            if (!raw || ttl < 0) return null;

            const parsed = JSON.parse(raw) as { data: T; cachedAt: number };
            const age = Math.floor((Date.now() - (parsed.cachedAt || 0)) / 1000);

            return { value: parsed.data, age };
        } catch (err) {
            logger.warn(`Cache getWithMeta error for "${key}":`, (err as Error).message);
            return null;
        }
    }

    /**
     * Store a value with metadata (timestamp for X-Cache-Age header).
     */
    async setWithMeta<T>(key: string, value: T, ttl?: number): Promise<void> {
        try {
            const client = getIORedisClient();
            if (!client) return;

            const wrapped = JSON.stringify({ data: value, cachedAt: Date.now() });
            const effectiveTtl = ttl ?? 300;

            await client.setex(key, effectiveTtl, wrapped);
        } catch (err) {
            logger.warn(`Cache setWithMeta error for "${key}":`, (err as Error).message);
        }
    }
}

// ── Singleton Export ────────────────────────────────────────────────────────────

export const cacheService = new CacheService();
export default cacheService;
