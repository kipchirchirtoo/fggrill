import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';

const credentialTtlSeconds = 55 * 60;

const powerSyncSecret = (): string => {
  const secret =
    process.env.POWERSYNC_JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('PowerSync credentials are not configured', 503);
  }
  return secret;
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
    const secret = powerSyncSecret();
    const endpoint = powerSyncEndpoint();

    const token = jwt.sign(
      {
        aud: 'authenticated',
        role: req.user.role,
        branch_id: req.user.branch_id ?? req.user.branchId ?? null,
        active_outlet_id: req.user.active_outlet_id ?? null,
        active_outlet_type: req.user.active_outlet_type ?? null,
        active_outlet_prefix: req.user.active_outlet_prefix ?? null,
        is_pos_login: req.user.is_pos_login === true,
      },
      secret,
      {
        algorithm: 'HS256',
        subject: String(req.user.id),
        expiresIn: credentialTtlSeconds,
      }
    );

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
 * Serve the PowerSync sync rules YAML. This endpoint is used by the PowerSync
 * service (or by deployment tooling) to load the active rules for the project.
 */
export const getPowerSyncRules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rulesPath = path.resolve(process.cwd(), 'powersync.yaml');
    if (!fs.existsSync(rulesPath)) {
      throw new AppError('PowerSync sync rules not found', 404);
    }
    const rules = fs.readFileSync(rulesPath, 'utf8');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(rules);
  } catch (error) {
    next(error);
  }
};
