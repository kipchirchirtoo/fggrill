import { Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import * as EnterpriseInventoryService from '../../services/enterprise-inventory.service';

type Handler = (req: Request, res: Response) => Promise<void>;

const asyncHandler = (handler: Handler): Handler => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error: any) {
    res.status(error.statusCode || error.status || 500).json({
      success: false,
      message: error.message || 'Inventory request failed'
    });
  }
};

const userIdFor = (req: Request): string => {
  const id = String((req as any).user?.id || '');
  if (!id) throw new AppError('Authentication required', 401);
  return id;
};

const branchIdFor = (req: Request): number => {
  const user = (req as any).user;
  const raw = req.body.branch_id ?? req.query.branch_id ?? user?.branch_id ?? user?.branchId;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new AppError('Branch is required', 400);
  return parsed;
};

const boolValue = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'approved'].includes(String(value).toLowerCase());
};

export const getDepartmentAccounts = asyncHandler(async (req: Request, res: Response) => {
  const branchId = branchIdFor(req);
  const data = await EnterpriseInventoryService.listDepartmentAccounts(branchId);
  res.json({ success: true, data });
});

export const seedDepartmentAccounts = asyncHandler(async (req: Request, res: Response) => {
  const branchId = branchIdFor(req);
  await EnterpriseInventoryService.seedDepartmentAccounts(branchId);
  const data = await EnterpriseInventoryService.listDepartmentAccounts(branchId);
  res.json({ success: true, data });
});

export const recordDepartmentIssue = asyncHandler(async (req: Request, res: Response) => {
  const branchId = branchIdFor(req);
  const userId = userIdFor(req);
  const result = await EnterpriseInventoryService.recordDepartmentIssue({
    branchId,
    itemSku: String(req.body.item_sku || req.body.itemSku || ''),
    quantity: Number(req.body.quantity),
    departmentCode: String(req.body.department_code || req.body.departmentCode || ''),
    actorId: userId,
    shiftCode: req.body.shift_code || req.body.shiftCode || null,
    destinationType: req.body.destination_type || req.body.destinationType || null,
    eventName: req.body.event_name || req.body.eventName || req.body.buffet_name || req.body.breakfast_name || null,
    eventDate: req.body.event_date || req.body.eventDate || null,
    location: req.body.location || null,
    paxCount: req.body.pax_count ?? req.body.paxCount ?? null,
    sourceType: req.body.source_type || req.body.sourceType || 'department_issue',
    sourceId: req.body.source_id || req.body.sourceId || null,
    sourceNumber: req.body.source_number || req.body.sourceNumber || null,
    notes: req.body.notes || req.body.reason || null,
    metadata: req.body.metadata || {}
  });

  res.status(201).json({ success: true, data: result });
});

export const listPosInventoryMappings = asyncHandler(async (req: Request, res: Response) => {
  const outletId = String(req.query.outlet_id || req.query.outletId || req.params.outletId || '');
  if (!outletId) throw new AppError('Outlet is required', 400);
  const data = await EnterpriseInventoryService.listPosInventoryMappings(outletId);
  res.json({ success: true, data });
});

export const upsertPosInventoryMapping = asyncHandler(async (req: Request, res: Response) => {
  const branchId = branchIdFor(req);
  const data = await EnterpriseInventoryService.upsertPosInventoryMapping({
    branchId,
    outletId: String(req.body.outlet_id || req.body.outletId || req.params.outletId || ''),
    outletItemId: String(req.body.outlet_item_id || req.body.outletItemId || req.params.outletItemId || ''),
    itemSku: String(req.body.item_sku || req.body.itemSku || ''),
    quantityPerSale: Number(req.body.quantity_per_sale ?? req.body.quantityPerSale ?? 1),
    isActive: boolValue(req.body.is_active ?? req.body.isActive, true),
    actorId: userIdFor(req)
  });

  res.json({ success: true, data });
});

export const getDepartmentConsumption = asyncHandler(async (req: Request, res: Response) => {
  const branchId = branchIdFor(req);
  const data = await EnterpriseInventoryService.listDepartmentConsumption({
    branchId,
    startDate: req.query.start_date as string || null,
    endDate: req.query.end_date as string || null,
    departmentCode: req.query.department_code as string || null
  });

  res.json({ success: true, data });
});

export const getDepartmentIssueJournals = asyncHandler(async (req: Request, res: Response) => {
  const branchId = branchIdFor(req);
  const data = await EnterpriseInventoryService.listDepartmentIssueJournals({
    branchId,
    startDate: req.query.start_date as string || null,
    endDate: req.query.end_date as string || null,
    departmentCode: req.query.department_code as string || null,
    limit: Number(req.query.limit || 200)
  });

  res.json({ success: true, data });
});

export const getDepartmentIssueJournalDetail = asyncHandler(async (req: Request, res: Response) => {
  const branchId = branchIdFor(req);
  const data = await EnterpriseInventoryService.getDepartmentIssueJournalDetail(branchId, req.params.id);
  res.json({ success: true, data });
});

export const getEnterpriseInventoryAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const branchId = branchIdFor(req);
  const data = await EnterpriseInventoryService.getEnterpriseInventoryAnalytics({
    branchId,
    startDate: req.query.start_date as string || null,
    endDate: req.query.end_date as string || null
  });

  res.json({ success: true, data });
});

export const getInventoryAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.query.branch_id || req.body.branch_id
    ? branchIdFor(req)
    : null;
  const data = await EnterpriseInventoryService.listInventoryAuditLog({
    branchId,
    action: req.query.action as string || null,
    limit: Number(req.query.limit || 100)
  });

  res.json({ success: true, data });
});

export const submitStockTakeToAccountant = asyncHandler(async (req: Request, res: Response) => {
  const data = await EnterpriseInventoryService.submitStockTakeToAccountant(req.params.id, userIdFor(req));
  res.json({ success: true, data, message: 'Stock take submitted to branch accountant' });
});

export const reviewStockTakeByAccountant = asyncHandler(async (req: Request, res: Response) => {
  const data = await EnterpriseInventoryService.reviewStockTakeByAccountant({
    stockCountId: req.params.id,
    actorId: userIdFor(req),
    approved: boolValue(req.body.approved ?? req.body.status, true),
    action: req.body.action || req.body.decision || null,
    notes: req.body.notes || req.body.reason || null
  });

  res.json({
    success: true,
    data,
    message: data.status === 'accountant_approved'
      ? 'Stock take approved and submitted to auditor'
      : data.status === 'under_review'
        ? 'Clarification requested from storekeeper'
        : 'Stock take rejected by accountant'
  });
});

export const finalizeStockTakeByAuditor = asyncHandler(async (req: Request, res: Response) => {
  const data = await EnterpriseInventoryService.finalizeStockTakeByAuditor({
    stockCountId: req.params.id,
    actorId: userIdFor(req),
    approved: boolValue(req.body.approved ?? req.body.status, true),
    notes: req.body.notes || req.body.reason || null
  });

  res.json({
    success: true,
    data,
    message: data.status === 'auditor_approved'
      ? 'Stock take finalized, locked, and variance adjustments posted'
      : 'Stock take flagged by auditor'
  });
});
