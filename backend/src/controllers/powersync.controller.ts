import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { exportJWK, importSPKI } from 'jose';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const credentialTtlSeconds = 55 * 60;

// Tables a PowerSync client may write back via the upload queue. Every other
// synced table (branches, users, notifications, pos_outlets, pos_outlet_items,
// branch_stock, etc.) is reference/master data owned by the existing REST
// endpoints, which carry business logic (shift totals, stock-count sync,
// audit logging) that a raw upsert here would bypass. Until that logic is
// reproduced per-table, those writes are rejected rather than silently
// dropped or blindly applied.
const POWERSYNC_WRITABLE_TABLES = new Set<string>([]);

const powerSyncSecret = (): string | null => {
  return (
    process.env.POWERSYNC_JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.JWT_SECRET ||
    null
  );
};

const powerSyncEndpoint = (): string => {
  const endpoint = String(process.env.POWERSYNC_URL || '').trim();
  if (!endpoint) {
    // Return a dummy endpoint instead of 503 so the frontend doesn't infinitely poll
    // the backend credentials endpoint in a tight loop when it's unconfigured.
    return 'https://unconfigured.powersync.local';
  }
  return endpoint;
};

const powerSyncKeyId = (): string => {
  return process.env.POWERSYNC_KEY_ID || 'powersync-key-1';
};

const powerSyncPrivateKey = (): string | null => {
  const keyPath =
    process.env.POWERSYNC_PRIVATE_KEY_PATH ||
    path.resolve(process.cwd(), 'powersync', 'private.pem');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8');
  }
  return null;
};

export const getPowerSyncCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentication required', 401);
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + credentialTtlSeconds;
    const endpoint = powerSyncEndpoint();

    const payload = {
      role: req.user.role,
      branch_id: req.user.branch_id ?? req.user.branchId ?? null,
      active_outlet_id: req.user.active_outlet_id ?? null,
      active_outlet_type: req.user.active_outlet_type ?? null,
      active_outlet_prefix: req.user.active_outlet_prefix ?? null,
      is_pos_login: req.user.is_pos_login === true,
    };

    const privateKey = powerSyncPrivateKey();
    let token: string;

    if (privateKey) {
      // Production RS256, verified by PowerSync via the JWKS endpoint below.
      token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        keyid: powerSyncKeyId(),
        subject: String(req.user.id),
        audience: endpoint,
        expiresIn: credentialTtlSeconds,
      });
    } else {
      // Development HS256 with a shared secret (no key pair configured yet).
      const secret = powerSyncSecret();
      if (!secret) {
        // Fallback dummy token for development so we don't throw 503
        token = jwt.sign(
          { ...payload, aud: 'authenticated' },
          'dummy_secret_for_unconfigured_powersync_dev',
          {
            algorithm: 'HS256',
            subject: String(req.user.id),
            expiresIn: credentialTtlSeconds,
          }
        );
      } else {
        token = jwt.sign(
          { ...payload, aud: 'authenticated' },
          secret,
          {
            algorithm: 'HS256',
            subject: String(req.user.id),
            expiresIn: credentialTtlSeconds,
          }
        );
      }
    }

    res.json({
      success: true,
      data: {
        endpoint,
        token,
        user_id: String(req.user.id),
        expires_at: new Date(expiresAt * 1000).toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * JWKS endpoint for RS256 auth. Must stay unauthenticated — the PowerSync
 * service polls this on its own schedule, with no user session of its own.
 *
 * To enable RS256 (replacing the HS256 dev fallback):
 *   1. Generate a key pair: node scripts/generate-powersync-keys.js
 *   2. Set POWERSYNC_PRIVATE_KEY_PATH / POWERSYNC_PUBLIC_KEY_PATH in .env
 *   3. Point the PowerSync instance's Client Auth at this JWKS URI
 *      (manual JWKS — "Use Supabase Auth" must stay OFF, since auth here is
 *      this app's own JWT, not a Supabase Auth session).
 */
export const getPowerSyncJWKS = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const publicKeyPath =
      process.env.POWERSYNC_PUBLIC_KEY_PATH ||
      path.resolve(process.cwd(), 'powersync', 'public.pem');

    if (!fs.existsSync(publicKeyPath)) {
      res.json({ keys: [] });
      return;
    }

    const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
    const keyLike = await importSPKI(publicKeyPem, 'RS256');
    const jwk = await exportJWK(keyLike);

    res.json({
      keys: [
        {
          ...jwk,
          kty: 'RSA',
          alg: 'RS256',
          kid: powerSyncKeyId(),
          use: 'sig',
        },
      ],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Receive pending writes from the PowerSync client upload queue.
 *
 * No client write path is wired up yet (the Flutter app only uses PowerSync
 * for read-side "hot cache" lookups — see powersync_service.dart), so this
 * never actually runs in production today. It still must never lie about
 * success: a 2xx with no persistence means the client discards the change
 * forever, believing it was saved. Per-table CRUD support belongs in
 * POWERSYNC_WRITABLE_TABLES above once a table's business logic (shift
 * totals, stock-count sync, audit trail) has an offline-safe equivalent.
 */
export const uploadPowerSyncData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const batch = req.body;
    if (!batch || !Array.isArray(batch)) {
      // Must stay 2xx — a 4xx here blocks the client's upload queue forever.
      res.json({ success: false, message: 'Expected an array of CRUD operations' });
      return;
    }

    const results = batch.map((op: any) => {
      const { op: operation, table, id } = op || {};
      if (!POWERSYNC_WRITABLE_TABLES.has(table)) {
        logger.warn('PowerSync upload rejected: table not writable via sync', { operation, table, id });
        return { id, table, applied: false, error: `Writes to "${table}" are not supported via PowerSync yet` };
      }
      // No writable tables are configured yet; per-table apply logic goes here.
      return { id, table, applied: false, error: 'Not implemented' };
    });

    logger.info('PowerSync upload batch received', { count: batch.length });
    res.json({ success: true, results });
  } catch (error) {
    next(error);
  }
};
