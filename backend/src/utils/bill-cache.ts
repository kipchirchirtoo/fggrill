import { logger } from './logger';

interface CachedBillData {
    data: unknown;
    timestamp: number;
    ttl: number;
}

export class BillCache {
    private static instance: BillCache;
    private cache: Map<string, CachedBillData> = new Map();
    private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

    static getInstance(): BillCache {
        if (!BillCache.instance) {
            BillCache.instance = new BillCache();
        }
        return BillCache.instance;
    }

    set(key: string, data: unknown, ttl: number = this.DEFAULT_TTL): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });

        // Clean up expired entries periodically
        if (this.cache.size % 50 === 0) {
            this.cleanup();
        }
    }

    get(key: string): unknown | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        // Check if expired
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    invalidate(key: string): void {
        this.cache.delete(key);
    }

    invalidatePattern(pattern: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > cached.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`Cleaned up ${cleaned} expired cache entries`);
        }
    }

    getStats(): { size: number; hitRate?: number } {
        return {
            size: this.cache.size
        };
    }

    clear(): void {
        this.cache.clear();
    }

    // Generate cache key for bill lookups
    static generateKey(searchId: string, branchId?: number): string {
        return `bill:${searchId}:branch:${branchId || 'all'}`;
    }
}

export const billCache = BillCache.getInstance();