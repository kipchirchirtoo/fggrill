import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import * as InventoryFoundationService from '../services/inventory-foundation.service';
import { isGlobalRole } from '../utils/branchIsolation';

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

const asyncHandler = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

const normalizeLocation = (value: any, branchId: number | null) => ({
  id: value?.id || value?.location_id || value?.locationId,
  branchId: value?.branch_id ?? value?.branchId ?? branchId,
  locationCode: value?.location_code || value?.locationCode || value?.code,
  locationName: value?.location_name || value?.locationName || value?.name,
  locationType: value?.location_type || value?.locationType || value?.type,
  departmentCode: value?.department_code || value?.departmentCode || null,
  outletId: value?.outlet_id || value?.outletId || null,
  metadata: value?.metadata || {}
});

const normalizeItem = (value: any) => ({
  id: value?.id || value?.item_id || value?.itemId,
  sku: value?.sku || value?.item_sku || value?.itemSku || value?.item_id || value?.itemId,
  sourceTable: value?.source_table || value?.sourceTable || 'simple_items',
  sourceItemKey: value?.source_item_key || value?.sourceItemKey || value?.sku || value?.item_sku || value?.itemSku || value?.item_id || value?.itemId,
  itemName: value?.item_name || value?.itemName || value?.name,
  description: value?.description || null,
  category: value?.category || null,
  unit: value?.unit || value?.unit_of_measure || value?.unitOfMeasure || 'units',
  isPerishable: value?.is_perishable ?? value?.isPerishable,
  trackingMode: value?.tracking_mode || value?.trackingMode,
  supplierReference: value?.supplier_reference || value?.supplierReference || null,
  defaultUnitCost: value?.default_unit_cost ?? value?.defaultUnitCost ?? value?.unit_cost ?? value?.unitCost,
  metadata: value?.metadata || {}
});

const normalizeBatch = (value: any) => {
  if (!value) return null;
  return {
    id: value.id || value.batch_id || value.batchId,
    batchNumber: value.batch_number || value.batchNumber || null,
    lotNumber: value.lot_number || value.lotNumber || null,
    expiryDate: value.expiry_date || value.expiryDate || null,
    supplierReference: value.supplier_reference || value.supplierReference || null,
    supplierId: value.supplier_id || value.supplierId || null,
    receivedDocumentType: value.received_document_type || value.receivedDocumentType || null,
    receivedDocumentReference: value.received_document_reference || value.receivedDocumentReference || null,
    unitCost: value.unit_cost ?? value.unitCost,
    metadata: value.metadata || {}
  };
};

export const getLocations = asyncHandler(async (req, res) => {
  const data = await InventoryFoundationService.listLocations({
    branchId: branchIdFor(req),
    type: req.query.type as string || null
  });
  res.json({ success: true, data });
});

export const getBalances = asyncHandler(async (req, res) => {
  const data = await InventoryFoundationService.listBalances({
    branchId: branchIdFor(req),
    locationId: req.query.location_id as string || req.query.locationId as string || null,
    search: req.query.search as string || null,
    limit: Number(req.query.limit || 200)
  });
  res.json({ success: true, data });
});

export const getMovements = asyncHandler(async (req, res) => {
  const data = await InventoryFoundationService.listMovements({
    branchId: branchIdFor(req),
    itemId: req.query.item_id as string || req.query.itemId as string || null,
    documentReference: req.query.document_reference as string || req.query.documentReference as string || null,
    limit: Number(req.query.limit || 200)
  });
  res.json({ success: true, data });
});

export const getReservations = asyncHandler(async (req, res) => {
  const data = await InventoryFoundationService.listReservations({
    branchId: branchIdFor(req),
    status: req.query.status as string || null,
    limit: Number(req.query.limit || 200)
  });
  res.json({ success: true, data });
});

export const getAlerts = asyncHandler(async (req, res) => {
  const data = await InventoryFoundationService.listAlerts({
    branchId: branchIdFor(req),
    status: req.query.status as string || 'open',
    limit: Number(req.query.limit || 100)
  });
  res.json({ success: true, data });
});

export const postMovement = asyncHandler(async (req, res) => {
  const branchId = branchIdFor(req);
  const data = await InventoryFoundationService.recordMovement({
    movementType: req.body.movement_type || req.body.movementType,
    item: normalizeItem(req.body.item || req.body),
    batch: normalizeBatch(req.body.batch),
    sourceLocation: normalizeLocation(req.body.source_location || req.body.sourceLocation, branchId),
    destinationLocation: normalizeLocation(req.body.destination_location || req.body.destinationLocation, branchId),
    quantity: Number(req.body.quantity),
    unitCost: Number(req.body.unit_cost ?? req.body.unitCost ?? 0),
    reason: req.body.reason,
    documentType: req.body.document_type || req.body.documentType,
    documentReference: req.body.document_reference || req.body.documentReference,
    documentNumber: req.body.document_number || req.body.documentNumber || null,
    reversible: req.body.reversible !== false,
    reversesMovementId: req.body.reverses_movement_id || req.body.reversesMovementId || null,
    allowNegative: req.body.allow_negative === true || req.body.allowNegative === true,
    metadata: req.body.metadata || {}
  }, userIdFor(req));

  res.status(201).json({ success: true, data });
});

export const postReservation = asyncHandler(async (req, res) => {
  const branchId = branchIdFor(req);
  const data = await InventoryFoundationService.reserveStock({
    item: normalizeItem(req.body.item || req.body),
    location: normalizeLocation(req.body.location || req.body.source_location || req.body.sourceLocation, branchId),
    batch: normalizeBatch(req.body.batch),
    quantity: Number(req.body.quantity),
    sourceDocumentType: req.body.source_document_type || req.body.sourceDocumentType || req.body.document_type || req.body.documentType,
    sourceDocumentReference: req.body.source_document_reference || req.body.sourceDocumentReference || req.body.document_reference || req.body.documentReference,
    sourceDocumentNumber: req.body.source_document_number || req.body.sourceDocumentNumber || req.body.document_number || req.body.documentNumber || null,
    reason: req.body.reason,
    expiresAt: req.body.expires_at || req.body.expiresAt || null,
    allowBackorder: req.body.allow_backorder === true || req.body.allowBackorder === true,
    metadata: req.body.metadata || {}
  }, userIdFor(req));

  res.status(201).json({ success: true, data });
});

export const releaseReservation = asyncHandler(async (req, res) => {
  const data = await InventoryFoundationService.releaseReservation({
    reservationId: req.params.id,
    actorId: userIdFor(req),
    status: req.body.status || 'released',
    reason: req.body.reason || null
  });
  res.json({ success: true, data });
});

export const recomputeBalances = asyncHandler(async (req, res) => {
  const data = await InventoryFoundationService.recomputeBalances({
    branchId: branchIdFor(req),
    actorId: userIdFor(req)
  });
  res.json({ success: true, data, count: data.length });
});
