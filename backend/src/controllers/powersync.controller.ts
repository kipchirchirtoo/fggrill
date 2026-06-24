import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const credentialTtlSeconds = 55 * 60;

const powerSyncSecret = (): string | null => {
  return (
    process.env.POWERSYNC_JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.JWT_SECRET ||
    null
  );
};

const powerSyncEndpoint = (): string => {
  const endpoint = String(
    process.env.POWERSYNC_URL ||
    'https://6a3baa5435ca576ca0df47ea.powersync.journeyapps.com'
  ).trim();
  if (!endpoint) {
    throw new AppError('PowerSync endpoint is not configured', 503);
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
      // Production RS256 with JWKS
      token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        keyid: powerSyncKeyId(),
        subject: String(req.user.id),
        audience: endpoint,
        expiresIn: credentialTtlSeconds,
      });
    } else {
      // Development HS256 with shared secret
      const secret = powerSyncSecret();
      if (!secret) {
        throw new AppError('PowerSync credentials are not configured', 503);
      }
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
 * Serve the PowerSync sync config YAML (Sync Streams edition 3).
 * This endpoint is used by the PowerSync service or deployment tooling
 * to load the active sync configuration for the project.
 */
export const getPowerSyncRules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const syncConfigPath = path.resolve(process.cwd(), 'powersync', 'sync-config.yaml');
    const legacyPath = path.resolve(process.cwd(), 'powersync.yaml');
    const rulesPath = fs.existsSync(syncConfigPath) ? syncConfigPath : legacyPath;
    if (!fs.existsSync(rulesPath)) {
      throw new AppError('PowerSync sync config not found', 404);
    }
    const rules = fs.readFileSync(rulesPath, 'utf8');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(rules);
  } catch (error) {
    next(error);
  }
};

/**
 * JWKS endpoint for RS256 production auth.
 *
 * To use RS256 instead of HS256:
 *   1. Generate a key pair: node scripts/generate-powersync-keys.js
 *   2. Set POWERSYNC_PRIVATE_KEY_PATH and POWERSYNC_PUBLIC_KEY_PATH in .env
 *   3. Configure the PowerSync service with this JWKS URI.
 *
 * If no public key is configured, this endpoint returns an empty key set.
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
    // Minimal JWKS for an RSA public key in PEM format. For a full JWK conversion
    // install `jose`; this stub exposes the PEM and metadata so operators can
    // complete the JWK conversion during PowerSync dashboard setup.
    res.json({
      keys: [
        {
          kty: 'RSA',
          alg: 'RS256',
          kid: process.env.POWERSYNC_KEY_ID || 'powersync-key-1',
          use: 'sig',
          pem: publicKeyPem,
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
 * The current rollout is read-only: the endpoint acknowledges every transaction
 * so the queue does not stall, but it does not yet persist mutations to the
 * source database. Implement per-table CRUD handling here to enable full
 * offline-first writes.
 */
export const uploadPowerSyncData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const batch = req.body;
    if (!batch || !Array.isArray(batch)) {
      res.status(400).json({ success: false, message: 'Expected an array of CRUD operations' });
      return;
    }

    logger.info('PowerSync upload batch received', { count: batch.length });

    for (const op of batch) {
      const { op: operation, table, id, opData } = op || {};
      logger.debug('PowerSync upload op', { operation, table, id });
      // TODO: apply the mutation to the source database based on operation:
      //   PUT    -> INSERT/UPSERT
      //   PATCH  -> UPDATE
      //   DELETE -> DELETE
    }

    // Returning 2xx advances the client's upload queue. Validation errors
    // must also return 2xx; only transient/server failures should be 5xx.
    res.json({ success: true, processed: batch.length });
  } catch (error) {
    next(error);
  }
};
