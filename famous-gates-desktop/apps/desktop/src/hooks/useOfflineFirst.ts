// useOfflineFirst — hybrid read hook: local cache first, remote refresh when online

import { useState, useEffect, useCallback } from 'react';
import { getCacheEntry, setCacheEntry } from '../services/local/sqlite';
import { isOnline } from '../services/sync/network';

interface UseOfflineFirstOptions<T> {
  cacheKey: string;
  entity: string;
  fetchRemote: () => Promise<T>;
  ttlSeconds?: number;
  enabled?: boolean;
}

interface UseOfflineFirstResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOfflineFirst<T>({
  cacheKey,
  entity,
  fetchRemote,
  ttlSeconds = 300,
  enabled = true,
}: UseOfflineFirstOptions<T>): UseOfflineFirstResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);

    // 1. Try local cache first
    try {
      const cached = await getCacheEntry(cacheKey);
      if (cached) {
        setData(JSON.parse(cached) as T);
        setIsLoading(false);
        setIsStale(true);
      }
    } catch {
      // cache miss — continue
    }

    // 2. If online, fetch remote and update cache
    if (isOnline()) {
      try {
        const remote = await fetchRemote();
        setData(remote);
        setIsStale(false);
        await setCacheEntry(cacheKey, entity, JSON.stringify(remote), ttlSeconds);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    }

    setIsLoading(false);
  }, [cacheKey, entity, fetchRemote, ttlSeconds, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, isStale, error, refetch: load };
}
