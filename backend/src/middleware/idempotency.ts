import { NextFunction, Request, Response } from 'express';
import {
  beginIdempotentRequest,
  failIdempotentRequest,
  finalizeIdempotentRequest
} from '../services/request-idempotency.service';
import { logger } from '../utils/logger';

type IdempotencyOptions = {
  resourceResolver?: (body: any) => { resourceId?: string | null; resourceType?: string | null };
  scope: string;
};

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

export const optionalIdempotency = (options: IdempotencyOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
    if (!idempotencyKey) {
      next();
      return;
    }

    req.idempotencyKey = idempotencyKey;

    try {
      const claim = await beginIdempotentRequest({
        branchId: req.user?.branch_id ?? null,
        deviceId: req.header('X-Device-Id') || req.header('X-Client-Id') || null,
        idempotencyKey,
        method: req.method,
        path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
        requestBody: req.body,
        scope: options.scope,
        userId: req.user?.id ?? null
      });

      if (claim.mode === 'disabled') {
        next();
        return;
      }

      if (claim.mode === 'replay') {
        res.setHeader('X-Idempotent-Replay', 'true');
        res.status(claim.responseStatus).json(claim.responseBody);
        return;
      }

      let finalized = false;
      const originalJson = res.json.bind(res);

      res.json = ((body: any) => {
        finalized = true;
        void finalizeIdempotentRequest({
          rowId: claim.rowId,
          responseBody: body,
          responseStatus: res.statusCode,
          ...(options.resourceResolver?.(body) || {})
        }).catch((error) => {
          logger.error('Failed to finalize idempotent response', {
            scope: options.scope,
            idempotencyKey,
            error: error instanceof Error ? error.message : String(error)
          });
        });
        return originalJson(body);
      }) as typeof res.json;

      res.on('finish', () => {
        if (finalized || res.statusCode < 400) return;
        void failIdempotentRequest(claim.rowId, `HTTP ${res.statusCode}`).catch((error) => {
          logger.error('Failed to release idempotency claim after non-success response', {
            scope: options.scope,
            idempotencyKey,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      });

      next();
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || 409);
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Duplicate request detected'
      });
    }
  };
};
