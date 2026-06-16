import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { isGlobalRole } from '../utils/branchIsolation';
import * as InventoryGovernanceService from '../services/inventory-governance.service';

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
    const parsedUserBranch = Number(userBranch);
    if (!Number.isFinite(parsedUserBranch)) throw new AppError('Branch ID required for this user', 400);
    return parsedUserBranch;
  }

  const raw = req.body.branch_id ?? req.body.branchId ?? req.query.branch_id ?? req.query.branchId ?? user?.branch_id ?? user?.branchId;
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new AppError('Branch must be a number', 400);
  return parsed;
};

export const getExceptions = asyncHandler(async (req, res) => {
  const result = await InventoryGovernanceService.getExceptionQueue({
    branchId: branchIdFor(req),
    status: req.query.status as string || null,
    severity: req.query.severity as string || null,
    limit: Number(req.query.limit || 100)
  });

  res.json({ success: true, ...result });
});

export const getAlerts = asyncHandler(async (req, res) => {
  const result = await InventoryGovernanceService.getAlertSummary({
    branchId: branchIdFor(req),
    status: req.query.status as string || null,
    limit: Number(req.query.limit || 25)
  });

  res.json({ success: true, data: result });
});

export const getDashboard = asyncHandler(async (req, res) => {
  const role = String(req.params.role || (req as any).user?.role || 'inventory');
  const result = await InventoryGovernanceService.getRoleDashboard({
    role,
    branchId: branchIdFor(req)
  });

  res.json({ success: true, ...result });
});

export const getDocuments = asyncHandler(async (req, res) => {
  const result = await InventoryGovernanceService.listGovernanceDocuments({
    branchId: branchIdFor(req),
    documentType: req.query.document_type as string || req.query.documentType as string || null,
    limit: Number(req.query.limit || 100)
  });

  res.json({ success: true, ...result });
});

export const getRules = asyncHandler(async (_req, res) => {
  const data = await InventoryGovernanceService.listGovernanceRules();
  res.json({ success: true, data });
});

export const reviewException = asyncHandler(async (req, res) => {
  const data = await InventoryGovernanceService.reviewException({
    branchId: branchIdFor(req),
    exceptionType: req.body.exception_type || req.body.exceptionType,
    severity: req.body.severity || null,
    sourceTable: req.body.source_table || req.body.sourceTable,
    sourceId: String(req.body.source_id || req.body.sourceId || ''),
    sourceNumber: req.body.source_number || req.body.sourceNumber || null,
    title: req.body.title || 'Inventory exception review',
    description: req.body.description || null,
    status: req.body.status || 'acknowledged',
    assignedRole: req.body.assigned_role || req.body.assignedRole || null,
    assignedTo: req.body.assigned_to || req.body.assignedTo || null,
    notes: req.body.notes || req.body.resolution_notes || req.body.resolutionNotes || null,
    actorId: userIdFor(req),
    metadata: req.body.metadata || {}
  });

  res.status(201).json({ success: true, data });
});
