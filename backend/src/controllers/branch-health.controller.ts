import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  BranchNotFoundError,
  getLatestHealthCheck,
  isCacheFresh,
  runFleetStructuralChecks,
  runHealthCheck,
} from '../services/branch-health.service';

/**
 * Branch Data-Health Checker endpoints.
 *
 * GET  /api/branches/fleet/health-check               — all-branch deterministic overview (central roles)
 * GET  /api/branches/:branchId/health-check          — cached (24h) unless force_refresh=true
 * POST /api/branches/:branchId/health-check/refresh  — always reruns (rate limited)
 */

function parseBranchId(req: Request, res: Response): number | null {
  const branchId = Number(req.params.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid branch id' });
    return null;
  }
  return branchId;
}

/**
 * Branch-level roles may only check their own branch; leadership/audit roles
 * may check any branch.
 */
function canAccessBranch(req: Request, branchId: number): boolean {
  const user: any = (req as any).user;
  if (!user) return false;
  const branchScopedRoles = ['branch_manager', 'branch_accountant', 'branch_operations_manager'];
  if (branchScopedRoles.includes(user.role) && user.branch_id != null) {
    return Number(user.branch_id) === branchId;
  }
  return true;
}

async function respondWithFreshCheck(branchId: number, res: Response): Promise<void> {
  const result = await runHealthCheck(branchId);
  res.status(200).json({ success: true, data: result });
}

export const getBranchHealthCheck = async (req: Request, res: Response): Promise<void> => {
  const branchId = parseBranchId(req, res);
  if (branchId === null) return;

  if (!canAccessBranch(req, branchId)) {
    res.status(403).json({ success: false, message: 'You can only check your own branch' });
    return;
  }

  try {
    const forceRefresh = req.query.force_refresh === 'true';
    if (!forceRefresh) {
      const cached = await getLatestHealthCheck(branchId);
      if (isCacheFresh(cached)) {
        res.status(200).json({ success: true, data: cached, cached: true });
        return;
      }
    }
    await respondWithFreshCheck(branchId, res);
  } catch (err) {
    handleHealthCheckError(err, branchId, res);
  }
};

export const refreshBranchHealthCheck = async (req: Request, res: Response): Promise<void> => {
  const branchId = parseBranchId(req, res);
  if (branchId === null) return;

  if (!canAccessBranch(req, branchId)) {
    res.status(403).json({ success: false, message: 'You can only check your own branch' });
    return;
  }

  try {
    await respondWithFreshCheck(branchId, res);
  } catch (err) {
    handleHealthCheckError(err, branchId, res);
  }
};

/**
 * All-branches overview: deterministic checks + severity-formula scores only
 * (no AI call), plus each branch's last cached AI-interpreted result. Restricted
 * to central oversight roles — branch-scoped roles use the per-branch endpoint.
 */
export const getFleetHealthCheck = async (req: Request, res: Response): Promise<void> => {
  const user: any = (req as any).user;
  const branchScopedRoles = ['branch_manager', 'branch_accountant', 'branch_operations_manager'];
  if (!user || branchScopedRoles.includes(user.role)) {
    res.status(403).json({
      success: false,
      message: 'Fleet health overview requires a central oversight role',
    });
    return;
  }

  try {
    const result = await runFleetStructuralChecks();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error('branch-health: fleet health check failed', {
      error: (err as Error).message,
    });
    res.status(500).json({ success: false, message: 'Fleet health check failed. Please try again.' });
  }
};

function handleHealthCheckError(err: unknown, branchId: number, res: Response): void {
  if (err instanceof BranchNotFoundError) {
    res.status(404).json({ success: false, message: err.message });
    return;
  }
  logger.error('branch-health: health check failed', {
    branchId,
    error: (err as Error).message,
  });
  res.status(500).json({ success: false, message: 'Health check failed. Please try again.' });
}
