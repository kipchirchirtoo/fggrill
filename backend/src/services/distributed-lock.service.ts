import crypto from 'crypto';
import { getIORedisClient } from '../config/redis';
import { logger } from '../utils/logger';

type LockHandle = {
  key: string;
  token: string;
};

const LOCK_PREFIX = 'fg:lock:';

export async function acquireDistributedLock(
  rawKey: string,
  ttlMs = 30000
): Promise<LockHandle | null> {
  const redis = getIORedisClient();
  if (!redis) return null;

  const key = `${LOCK_PREFIX}${rawKey}`;
  const token = crypto.randomUUID();

  try {
    const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? { key, token } : null;
  } catch (error) {
    logger.warn('Distributed lock acquisition failed; continuing without lock', {
      rawKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function releaseDistributedLock(lock: LockHandle | null | undefined): Promise<void> {
  if (!lock) return;
  const redis = getIORedisClient();
  if (!redis) return;

  try {
    await redis.eval(
      `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `,
      1,
      lock.key,
      lock.token
    );
  } catch (error) {
    logger.warn('Distributed lock release failed', {
      key: lock.key,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
