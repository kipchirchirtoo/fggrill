import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import * as InventoryOperationsService from '../services/inventory-operations.service';
import { isGlobalRole } from '../utils/branchIsolation';

const asyncHandler = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

const userIdFor = (req: Request): string => {
  const id = String((req as any).user?.id || '');
  if (!id) throw new AppError('Authentication required', 401);
  return id;
};

const branchIdFor = (req: Request): number | null => {
  const user = (req as any).user;
  if (!isGlobalRole(user?.role)) {
    const userBranch = user?.branch_id ?? user?.branchId;
    if (userBranch === undefined || userBranch === null || userBranch === '') {
      throw new AppError('Branch ID required for this user', 400);
    }
    const parsedUserBranch = Number(userBranch);
    if (!Number.isFinite(parsedUserBranch)) throw new AppError('User branch must be a number', 400);
    return parsedUserBranch;
  }

  const raw = req.body.branch_id ?? req.body.branchId ?? req.query.branch_id ?? req.query.branchId ?? user?.branch_id ?? user?.branchId;
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new AppError('Branch must be a number', 400);
  return parsed;
};

export const getOutletStock = asyncHandler(async (req, res) => {
  const data = await InventoryOperationsService.listOutletStock({
    branchId: branchIdFor(req),
    outletId: req.query.outlet_id as string || req.query.outletId as string || null,
    search: req.query.search as string || null,
    limit: Number(req.query.limit || 200)
  });
  res.json({ success: true, data });
});

export const createProductionRun = asyncHandler(async (req, res) => {
  const branchId = branchIdFor(req);
  const data = await InventoryOperationsService.postProductionRun({
    ...req.body,
    branch_id: req.body.branch_id ?? req.body.branchId ?? branchId
  }, userIdFor(req));
  res.status(201).json({ success: true, data });
});

export const closeOutletStockVariance = asyncHandler(async (req, res) => {
  const data = await InventoryOperationsService.closeOutletVariance(req.params.shiftId, userIdFor(req));
  res.json({ success: true, data });
});

export const getAdjustmentRequests = asyncHandler(async (req, res) => {
  const data = await InventoryOperationsService.listAdjustmentRequests({
    branchId: branchIdFor(req),
    status: req.query.status as string || null,
    limit: Number(req.query.limit || 100)
  });
  res.json({ success: true, data });
});

export const createAdjustmentRequest = asyncHandler(async (req, res) => {
  const branchId = branchIdFor(req);
  const data = await InventoryOperationsService.createAdjustmentRequest({
    ...req.body,
    branch_id: req.body.branch_id ?? req.body.branchId ?? branchId
  }, userIdFor(req));
  res.status(201).json({ success: true, data });
});

export const reviewAdjustmentRequest = asyncHandler(async (req, res) => {
  const data = await InventoryOperationsService.reviewAdjustmentRequest(req.params.id, req.body || {}, userIdFor(req));
  res.json({ success: true, data });
});

export const postAdjustmentRequest = asyncHandler(async (req, res) => {
  const data = await InventoryOperationsService.postAdjustmentRequest(req.params.id, userIdFor(req));
  res.json({ success: true, data });
});
