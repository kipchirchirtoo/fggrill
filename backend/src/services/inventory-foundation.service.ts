import crypto from 'crypto';
import { PoolClient } from 'pg';
import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  InventoryBalanceSnapshot,
  InventoryBatchInput,
  InventoryItemInput,
  InventoryLocationInput,
  InventoryMovementInput,
  InventoryMovementType,
  InventoryReservationInput
} from '../models/inventory-foundation.model';

type JsonRecord = Record<string, any>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STOCK_NEUTRAL_MOVEMENTS = new Set<InventoryMovementType>(['reservation', 'reservation_release']);
const SOURCE_DEPLETION_MOVEMENTS = new Set<InventoryMovementType>([
  'branch_requisition_dispatch',
  'central_store_packing',
  'department_issue',
  'pos_issue',
  'production_consumption',
  'write_off',
  'transfer',
  'stock_take_adjustment'
]);

const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const requiredText = (value: unknown, label: string): string => {
  const text = String(value ?? '').trim();
  if (!text) throw new AppError(`${label} is required`, 400);
  return text;
};

export const calculateAvailableQuantity = (input: {
  currentQuantity: number;
  reservedQuantity?: number;
  damagedQuantity?: number;
  expiredQuantity?: number;
}): number => {
  return (
    numberValue(input.currentQuantity)
    - numberValue(input.reservedQuantity)
    - numberValue(input.damagedQuantity)
    - numberValue(input.expiredQuantity)
  );
};

const movementNumber = (): string =>
  `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

const reservationNumber = (): string =>
  `RSV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

const defaultLocationCode = (input: InventoryLocationInput): string => {
  const branchPart = input.branchId ? `B${input.branchId}` : 'GLOBAL';
  const type = input.locationType || 'external';
  const detail = input.departmentCode || input.outletId || input.locationName || type;
  return `${branchPart}-${type}-${String(detail).replace(/[^a-z0-9]+/gi, '-').toUpperCase()}`.replace(/-+/g, '-');
};

async function ensureLocation(
  client: PoolClient,
  input: InventoryLocationInput,
  actorId: string
): Promise<JsonRecord> {
  if (input.id && UUID_RE.test(input.id)) {
    const found = await client.query('SELECT * FROM inventory_locations WHERE id = $1', [input.id]);
    if (found.rows[0]) return found.rows[0];
  }

  const locationCode = requiredText(input.locationCode || defaultLocationCode(input), 'Location code');
  const locationName = requiredText(input.locationName || locationCode.replace(/-/g, ' '), 'Location name');
  let locationType: string = input.locationType || 'external';
  if (locationType === 'transit') {
    locationType = 'in_transit';
  }

  const result = await client.query(
    `
      INSERT INTO inventory_locations (
        branch_id, location_code, location_name, location_type, department_code, outlet_id, metadata, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      ON CONFLICT (location_code)
      DO UPDATE SET
        location_name = EXCLUDED.location_name,
        location_type = EXCLUDED.location_type,
        department_code = COALESCE(EXCLUDED.department_code, inventory_locations.department_code),
        outlet_id = COALESCE(EXCLUDED.outlet_id, inventory_locations.outlet_id),
        metadata = inventory_locations.metadata || EXCLUDED.metadata
      RETURNING *
    `,
    [
      input.branchId ?? null,
      locationCode,
      locationName,
      locationType,
      input.departmentCode ?? null,
      input.outletId ?? null,
      JSON.stringify(input.metadata || {}),
      actorId
    ]
  );

  return result.rows[0];
}

async function ensureItem(
  client: PoolClient,
  input: InventoryItemInput,
  actorId: string
): Promise<JsonRecord> {
  if (input.id && UUID_RE.test(input.id)) {
    const found = await client.query('SELECT * FROM inventory_items WHERE id = $1', [input.id]);
    if (found.rows[0]) return found.rows[0];
  }

  const sku = requiredText(input.sku || input.sourceItemKey || input.id, 'Item SKU');

  let itemName = input.itemName || '';
  let description = input.description || null;
  let category = input.category || null;
  let unit = input.unit || 'units';
  let unitCost = numberValue(input.defaultUnitCost);
  let isPerishable = input.isPerishable === true;
  let trackingMode = input.trackingMode || (isPerishable ? 'batch' : 'standard');

  if (!itemName || !input.unit || !input.category || !input.defaultUnitCost) {
    const legacy = await client.query(
      `
        SELECT sku, item_name, description, category, unit_of_measure, cost_price
        FROM simple_items
        WHERE sku = $1
        LIMIT 1
      `,
      [sku]
    );
    const row = legacy.rows[0];
    if (row) {
      itemName = itemName || row.item_name || row.description || sku;
      description = description || row.description || null;
      category = category || row.category || null;
      unit = input.unit || row.unit_of_measure || 'units';
      unitCost = input.defaultUnitCost ?? numberValue(row.cost_price);
      isPerishable = input.isPerishable ?? false;
    }
  }

  itemName = requiredText(itemName || sku, 'Item name');
  // Re-check tracking_mode with resolved isPerishable
  trackingMode = input.trackingMode || (isPerishable ? 'batch' : 'standard');

  const result = await client.query(
    `
      INSERT INTO inventory_items (
        sku, item_name, description, category, unit,
        is_perishable, tracking_mode, default_unit_cost, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (sku)
      DO UPDATE SET
        item_name = EXCLUDED.item_name,
        description = COALESCE(EXCLUDED.description, inventory_items.description),
        category = COALESCE(EXCLUDED.category, inventory_items.category),
        unit = EXCLUDED.unit,
        is_perishable = EXCLUDED.is_perishable,
        tracking_mode = EXCLUDED.tracking_mode,
        default_unit_cost = EXCLUDED.default_unit_cost,
        metadata = inventory_items.metadata || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `,
    [
      sku,
      itemName,
      description,
      category,
      unit,
      isPerishable,
      trackingMode,
      unitCost,
      JSON.stringify(input.metadata || {})
    ]
  );

  return result.rows[0];
}

async function ensureBatch(
  client: PoolClient,
  itemId: string,
  input: InventoryBatchInput | null | undefined,
  actorId: string
): Promise<JsonRecord | null> {
  if (!input) return null;
  if (input.id && UUID_RE.test(input.id)) {
    const found = await client.query('SELECT * FROM inventory_core_batches WHERE id = $1', [input.id]);
    if (found.rows[0]) return found.rows[0];
  }

  if (!input.batchNumber && !input.lotNumber && !input.expiryDate) return null;

  const existing = await client.query(
    `
      SELECT *
      FROM inventory_core_batches
      WHERE item_id = $1
        AND COALESCE(batch_number, '') = COALESCE($2, '')
        AND COALESCE(lot_number, '') = COALESCE($3, '')
        AND COALESCE(expiry_date::text, '') = COALESCE($4, '')
      LIMIT 1
    `,
    [itemId, input.batchNumber ?? null, input.lotNumber ?? null, input.expiryDate ?? null]
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await client.query(
    `
      INSERT INTO inventory_core_batches (
        item_id, batch_number, lot_number, expiry_date, supplier_reference, supplier_id,
        received_document_type, received_document_reference, unit_cost, metadata, created_by
      )
      VALUES ($1, $2, $3, $4::date, $5, $6::uuid, $7, $8, $9, $10::jsonb, $11)
      RETURNING *
    `,
    [
      itemId,
      input.batchNumber ?? null,
      input.lotNumber ?? null,
      input.expiryDate ?? null,
      input.supplierReference ?? null,
      input.supplierId ?? null,
      input.receivedDocumentType ?? null,
      input.receivedDocumentReference ?? null,
      numberValue(input.unitCost),
      JSON.stringify(input.metadata || {}),
      actorId
    ]
  );

  return created.rows[0];
}

async function computeBalance(
  client: PoolClient,
  itemId: string,
  locationId: string,
  batchId: string | null
): Promise<InventoryBalanceSnapshot> {
  const currentResult = await client.query(
    `
      SELECT COALESCE(SUM(
        CASE
          WHEN destination_location_id = $2 THEN quantity
          WHEN source_location_id = $2 THEN -quantity
          ELSE 0
        END
      ), 0)::numeric AS current_quantity
      FROM inventory_movements
      WHERE item_id = $1
        AND (($3::uuid IS NULL AND batch_id IS NULL) OR batch_id = $3::uuid)
        AND movement_type NOT IN ('reservation', 'reservation_release')
        AND (source_location_id = $2 OR destination_location_id = $2)
    `,
    [itemId, locationId, batchId]
  );

  const reservedResult = await client.query(
    `
      SELECT COALESCE(SUM(quantity - fulfilled_quantity), 0)::numeric AS reserved_quantity
      FROM inventory_reservations
      WHERE item_id = $1
        AND location_id = $2
        AND (($3::uuid IS NULL AND batch_id IS NULL) OR batch_id = $3::uuid)
        AND status = 'reserved'
    `,
    [itemId, locationId, batchId]
  );

  const currentQuantity = Math.max(0, numberValue(currentResult.rows[0]?.current_quantity));
  const reservedQuantity = numberValue(reservedResult.rows[0]?.reserved_quantity);
  const expiredResult = batchId
    ? await client.query(
        `
          SELECT CASE WHEN expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE
            THEN $2::numeric
            ELSE 0::numeric
          END AS expired_quantity
          FROM inventory_core_batches
          WHERE id = $1::uuid
        `,
        [batchId, currentQuantity]
      )
    : { rows: [{ expired_quantity: 0 }] };
  const expiredQuantity = batchId ? numberValue(expiredResult.rows[0]?.expired_quantity) : 0;
  const damagedQuantity = 0;
  const availableQuantity = calculateAvailableQuantity({
    currentQuantity,
    reservedQuantity,
    damagedQuantity,
    expiredQuantity
  });

  return {
    currentQuantity,
    reservedQuantity,
    damagedQuantity,
    expiredQuantity,
    availableQuantity: Math.max(0, availableQuantity)
  };
}

async function upsertBalance(
  client: PoolClient,
  itemId: string,
  locationId: string,
  batchId: string | null,
  unitCost: number,
  lastMovementId: string | null
): Promise<JsonRecord> {
  const snapshot = await computeBalance(client, itemId, locationId, batchId);
  const existing = await client.query(
    `
      SELECT *
      FROM inventory_balances
      WHERE item_id = $1
        AND location_id = $2
        AND (($3::uuid IS NULL AND batch_id IS NULL) OR batch_id = $3::uuid)
      FOR UPDATE
    `,
    [itemId, locationId, batchId]
  );

  if (existing.rows[0]) {
    const updated = await client.query(
      `
        UPDATE inventory_balances
        SET current_quantity = $2,
            reserved_quantity = $3,
            damaged_quantity = $4,
            expired_quantity = $5,
            unit_cost = CASE WHEN $6::numeric > 0 THEN $6 ELSE unit_cost END,
            last_movement_id = COALESCE($7::uuid, last_movement_id)
        WHERE id = $1
        RETURNING *
      `,
      [
        existing.rows[0].id,
        snapshot.currentQuantity,
        snapshot.reservedQuantity,
        snapshot.damagedQuantity,
        snapshot.expiredQuantity,
        unitCost,
        lastMovementId
      ]
    );
    return updated.rows[0];
  }

  const inserted = await client.query(
    `
      INSERT INTO inventory_balances (
        item_id, location_id, batch_id, current_quantity, reserved_quantity,
        damaged_quantity, expired_quantity, unit_cost, last_movement_id
      )
      VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9::uuid)
      RETURNING *
    `,
    [
      itemId,
      locationId,
      batchId,
      snapshot.currentQuantity,
      snapshot.reservedQuantity,
      snapshot.damagedQuantity,
      snapshot.expiredQuantity,
      unitCost,
      lastMovementId
    ]
  );
  return inserted.rows[0];
}

async function insertAudit(
  client: PoolClient,
  input: {
    branchId?: number | null;
    actorId: string;
    actionType: string;
    entityType: string;
    entityId?: string | null;
    itemId?: string | null;
    locationId?: string | null;
    beforeValue?: JsonRecord | null;
    afterValue?: JsonRecord | null;
    reason: string;
    documentType?: string | null;
    documentReference?: string | null;
    metadata?: JsonRecord | null;
  }
) {
  await client.query(
    `
      INSERT INTO inventory_audit_logs (
        branch_id, actor_id, action_type, entity_type, entity_id, item_id, location_id,
        before_value, after_value, reason, source_document_type, source_document_reference, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::uuid, $8::jsonb, $9::jsonb, $10, $11, $12, $13::jsonb)
    `,
    [
      input.branchId ?? null,
      input.actorId,
      input.actionType,
      input.entityType,
      input.entityId ?? null,
      input.itemId ?? null,
      input.locationId ?? null,
      JSON.stringify(input.beforeValue ?? null),
      JSON.stringify(input.afterValue ?? null),
      input.reason,
      input.documentType ?? null,
      input.documentReference ?? null,
      JSON.stringify(input.metadata || {})
    ]
  );
}

async function createAlert(
  client: PoolClient,
  input: {
    branchId?: number | null;
    itemId?: string | null;
    locationId?: string | null;
    alertType: string;
    severity: string;
    message: string;
    documentType?: string | null;
    documentReference?: string | null;
    actorId?: string | null;
    metadata?: JsonRecord | null;
  }
) {
  await client.query(
    `
      INSERT INTO inventory_alerts (
        branch_id, item_id, location_id, alert_type, severity, message,
        source_document_type, source_document_reference, created_by, metadata
      )
      VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9::uuid, $10::jsonb)
    `,
    [
      input.branchId ?? null,
      input.itemId ?? null,
      input.locationId ?? null,
      input.alertType,
      input.severity,
      input.message,
      input.documentType ?? null,
      input.documentReference ?? null,
      input.actorId ?? null,
      JSON.stringify(input.metadata || {})
    ]
  );
}

function balancePlain(row: JsonRecord | null): JsonRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    current_quantity: numberValue(row.current_quantity),
    reserved_quantity: numberValue(row.reserved_quantity),
    damaged_quantity: numberValue(row.damaged_quantity),
    expired_quantity: numberValue(row.expired_quantity),
    available_quantity: numberValue(row.available_quantity),
    unit_cost: numberValue(row.unit_cost)
  };
}

export async function recordMovement(input: InventoryMovementInput, actorId: string) {
  requiredText(actorId, 'Actor');
  const quantity = numberValue(input.quantity);
  if (quantity <= 0) throw new AppError('Movement quantity must be greater than zero', 400);
  const reason = requiredText(input.reason, 'Movement reason');
  const documentType = requiredText(input.documentType, 'Document type');
  const documentReference = requiredText(input.documentReference, 'Document reference');

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const item = await ensureItem(client, input.item, actorId);
    const source = await ensureLocation(client, input.sourceLocation, actorId);
    const destination = await ensureLocation(client, input.destinationLocation, actorId);
    const batch = await ensureBatch(client, item.id, input.batch || null, actorId);
    const batchId = batch?.id || null;
    const unitCost = numberValue(input.unitCost ?? input.batch?.unitCost ?? item.default_unit_cost);

    const sourceBefore = await upsertBalance(client, item.id, source.id, batchId, unitCost, null);
    const destinationBefore = source.id === destination.id
      ? sourceBefore
      : await upsertBalance(client, item.id, destination.id, batchId, unitCost, null);

    const depletesSource = SOURCE_DEPLETION_MOVEMENTS.has(input.movementType) && source.id !== destination.id;

    if (depletesSource && !STOCK_NEUTRAL_MOVEMENTS.has(input.movementType) && !input.allowNegative) {
      const sourceAfter = numberValue(sourceBefore.current_quantity) - quantity;
      if (sourceAfter < 0) {
        await createAlert(client, {
          branchId: source.branch_id ?? destination.branch_id ?? null,
          itemId: item.id,
          locationId: source.id,
          alertType: 'negative_balance_attempt',
          severity: 'critical',
          message: `Negative inventory attempt blocked for ${item.item_name}. Available current stock ${sourceBefore.current_quantity}, requested ${quantity}.`,
          documentType,
          documentReference,
          actorId,
          metadata: { movement_type: input.movementType, sku: item.sku }
        });
        throw new AppError(`Insufficient stock for ${item.item_name}. Current ${sourceBefore.current_quantity}, requested ${quantity}`, 409);
      }
    }

    const movement = await client.query(
      `
        INSERT INTO inventory_movements (
          movement_number, movement_type, item_id, batch_id, source_location_id,
          destination_location_id, quantity, unit_cost, reason, document_type,
          document_reference, document_number, actor_id, reversible, reverses_movement_id,
          source_balance_before, destination_balance_before, metadata
        )
        VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::uuid, $16, $17, $18::jsonb)
        RETURNING *
      `,
      [
        movementNumber(),
        input.movementType,
        item.id,
        batchId,
        source.id,
        destination.id,
        quantity,
        unitCost,
        reason,
        documentType,
        documentReference,
        input.documentNumber ?? null,
        actorId,
        input.reversible !== false,
        input.reversesMovementId ?? null,
        sourceBefore.current_quantity,
        destinationBefore.current_quantity,
        JSON.stringify(input.metadata || {})
      ]
    );

    const movementRow = movement.rows[0];
    const sourceAfter = await upsertBalance(client, item.id, source.id, batchId, unitCost, movementRow.id);
    const destinationAfter = source.id === destination.id
      ? sourceAfter
      : await upsertBalance(client, item.id, destination.id, batchId, unitCost, movementRow.id);

    await insertAudit(client, {
      branchId: source.branch_id ?? destination.branch_id ?? null,
      actorId,
      actionType: `movement.${input.movementType}`,
      entityType: 'inventory_movement',
      entityId: movementRow.id,
      itemId: item.id,
      locationId: destination.id,
      beforeValue: {
        source: balancePlain(sourceBefore),
        destination: balancePlain(destinationBefore)
      },
      afterValue: {
        source: balancePlain(sourceAfter),
        destination: balancePlain(destinationAfter)
      },
      reason,
      documentType,
      documentReference,
      metadata: { movement_number: movementRow.movement_number, sku: item.sku }
    });

    if (depletesSource && numberValue(sourceAfter.available_quantity) <= 0) {
      await createAlert(client, {
        branchId: source.branch_id ?? null,
        itemId: item.id,
        locationId: source.id,
        alertType: 'out_of_stock',
        severity: 'high',
        message: `${item.item_name} is out of stock at ${source.location_name}.`,
        documentType,
        documentReference,
        actorId,
        metadata: { sku: item.sku, balance: balancePlain(sourceAfter) }
      });
    } else if (depletesSource && numberValue(sourceAfter.available_quantity) <= 5) {
      await createAlert(client, {
        branchId: source.branch_id ?? null,
        itemId: item.id,
        locationId: source.id,
        alertType: 'low_stock',
        severity: 'medium',
        message: `${item.item_name} is low at ${source.location_name}. Available ${sourceAfter.available_quantity}.`,
        documentType,
        documentReference,
        actorId,
        metadata: { sku: item.sku, balance: balancePlain(sourceAfter) }
      });
    }

    await client.query('COMMIT');
    return {
      movement: { ...movementRow, source_balance_after: sourceAfter.current_quantity, destination_balance_after: destinationAfter.current_quantity },
      item,
      batch,
      source_location: source,
      destination_location: destination,
      source_balance: sourceAfter,
      destination_balance: destinationAfter
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function reserveStock(input: InventoryReservationInput, actorId: string) {
  requiredText(actorId, 'Actor');
  const quantity = numberValue(input.quantity);
  if (quantity <= 0) throw new AppError('Reservation quantity must be greater than zero', 400);
  const reason = requiredText(input.reason, 'Reservation reason');
  const sourceDocumentType = requiredText(input.sourceDocumentType, 'Source document type');
  const sourceDocumentReference = requiredText(input.sourceDocumentReference, 'Source document reference');

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const item = await ensureItem(client, input.item, actorId);
    const location = await ensureLocation(client, input.location, actorId);
    const batch = await ensureBatch(client, item.id, input.batch || null, actorId);
    const balanceBefore = await upsertBalance(client, item.id, location.id, batch?.id || null, 0, null);

    if (!input.allowBackorder && numberValue(balanceBefore.available_quantity) < quantity) {
      await createAlert(client, {
        branchId: location.branch_id ?? null,
        itemId: item.id,
        locationId: location.id,
        alertType: 'over_reservation_attempt',
        severity: 'critical',
        message: `Reservation blocked for ${item.item_name}. Available ${balanceBefore.available_quantity}, requested ${quantity}.`,
        documentType: sourceDocumentType,
        documentReference: sourceDocumentReference,
        actorId,
        metadata: { sku: item.sku }
      });
      throw new AppError(`Insufficient available stock for reservation. Available ${balanceBefore.available_quantity}, requested ${quantity}`, 409);
    }

    const reservation = await client.query(
      `
        INSERT INTO inventory_reservations (
          reservation_number, item_id, location_id, batch_id, quantity,
          source_document_type, source_document_reference, source_document_number,
          reason, reserved_by, expires_at, metadata
        )
        VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::jsonb)
        RETURNING *
      `,
      [
        reservationNumber(),
        item.id,
        location.id,
        batch?.id || null,
        quantity,
        sourceDocumentType,
        sourceDocumentReference,
        input.sourceDocumentNumber ?? null,
        reason,
        actorId,
        input.expiresAt ?? null,
        JSON.stringify(input.metadata || {})
      ]
    );

    const reservationLocation = await ensureLocation(client, {
      branchId: location.branch_id ?? null,
      locationType: 'reservation',
      locationCode: `${location.location_code}-RESERVED`,
      locationName: `${location.location_name} Reserved`
    }, actorId);

    await client.query(
      `
        INSERT INTO inventory_movements (
          movement_number, movement_type, item_id, batch_id, source_location_id,
          destination_location_id, quantity, unit_cost, reason, document_type,
          document_reference, document_number, actor_id, metadata
        )
        VALUES ($1, 'reservation', $2, $3::uuid, $4, $5, $6, 0, $7, $8, $9, $10, $11, $12::jsonb)
      `,
      [
        movementNumber(),
        item.id,
        batch?.id || null,
        location.id,
        reservationLocation.id,
        quantity,
        reason,
        sourceDocumentType,
        sourceDocumentReference,
        input.sourceDocumentNumber ?? null,
        actorId,
        JSON.stringify({ ...(input.metadata || {}), reservation_id: reservation.rows[0].id })
      ]
    );

    const balanceAfter = await upsertBalance(client, item.id, location.id, batch?.id || null, 0, null);

    await insertAudit(client, {
      branchId: location.branch_id ?? null,
      actorId,
      actionType: 'reservation.created',
      entityType: 'inventory_reservation',
      entityId: reservation.rows[0].id,
      itemId: item.id,
      locationId: location.id,
      beforeValue: balancePlain(balanceBefore),
      afterValue: balancePlain(balanceAfter),
      reason,
      documentType: sourceDocumentType,
      documentReference: sourceDocumentReference,
      metadata: { reservation_number: reservation.rows[0].reservation_number, sku: item.sku }
    });

    await client.query('COMMIT');
    return { reservation: reservation.rows[0], item, batch, location, balance: balanceAfter };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseReservation(input: {
  reservationId: string;
  actorId: string;
  status?: 'released' | 'expired' | 'cancelled';
  reason?: string | null;
}) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM inventory_reservations WHERE id = $1 FOR UPDATE', [input.reservationId]);
    const reservation = current.rows[0];
    if (!reservation) throw new AppError('Reservation not found', 404);
    if (reservation.status !== 'reserved') throw new AppError(`Reservation is already ${reservation.status}`, 409);

    const nextStatus = input.status || 'released';
    const updated = await client.query(
      `
        UPDATE inventory_reservations
        SET status = $2, released_by = $3
        WHERE id = $1
        RETURNING *
      `,
      [input.reservationId, nextStatus, input.actorId]
    );

    const location = await client.query('SELECT * FROM inventory_locations WHERE id = $1', [reservation.location_id]);
    const reservationLocation = await ensureLocation(client, {
      branchId: location.rows[0]?.branch_id ?? null,
      locationType: 'reservation',
      locationCode: `${location.rows[0]?.location_code || 'UNKNOWN'}-RESERVED`,
      locationName: `${location.rows[0]?.location_name || 'Unknown'} Reserved`
    }, input.actorId);

    await client.query(
      `
        INSERT INTO inventory_movements (
          movement_number, movement_type, item_id, batch_id, source_location_id,
          destination_location_id, quantity, unit_cost, reason, document_type,
          document_reference, document_number, actor_id, metadata
        )
        VALUES ($1, 'reservation_release', $2, $3::uuid, $4, $5, $6, 0, $7, $8, $9, $10, $11, $12::jsonb)
      `,
      [
        movementNumber(),
        reservation.item_id,
        reservation.batch_id,
        reservationLocation.id,
        reservation.location_id,
        numberValue(reservation.quantity) - numberValue(reservation.fulfilled_quantity),
        input.reason || `Reservation ${nextStatus}`,
        reservation.source_document_type,
        reservation.source_document_reference,
        reservation.source_document_number,
        input.actorId,
        JSON.stringify({ reservation_id: input.reservationId, released_status: nextStatus })
      ]
    );

    const balance = await upsertBalance(client, reservation.item_id, reservation.location_id, reservation.batch_id, 0, null);

    await insertAudit(client, {
      branchId: location.rows[0]?.branch_id ?? null,
      actorId: input.actorId,
      actionType: `reservation.${nextStatus}`,
      entityType: 'inventory_reservation',
      entityId: input.reservationId,
      itemId: reservation.item_id,
      locationId: reservation.location_id,
      beforeValue: reservation,
      afterValue: updated.rows[0],
      reason: input.reason || `Reservation ${nextStatus}`,
      documentType: reservation.source_document_type,
      documentReference: reservation.source_document_reference
    });

    await client.query('COMMIT');
    return { reservation: updated.rows[0], balance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listBalances(filters: {
  branchId?: number | null;
  locationId?: string | null;
  search?: string | null;
  limit?: number;
}) {
  const params: any[] = [];
  const where: string[] = [];
  if (filters.branchId) {
    params.push(filters.branchId);
    where.push(`l.branch_id = $${params.length}`);
  }
  if (filters.locationId) {
    params.push(filters.locationId);
    where.push(`b.location_id = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`(i.sku ILIKE $${params.length} OR i.item_name ILIKE $${params.length} OR l.name ILIKE $${params.length})`);
  }
  params.push(Math.min(Math.max(filters.limit || 200, 1), 500));

  const result = await db.query(
    `
      SELECT b.*, i.sku, i.item_name, i.category, i.unit, l.location_code, l.name AS location_name, l.location_type, l.branch_id,
             batch.batch_number, batch.lot_number, batch.expiry_date
      FROM inventory_balances b
      JOIN inventory_items i ON i.id = b.item_id
      JOIN inventory_locations l ON l.id = b.location_id
      LEFT JOIN inventory_batches batch ON batch.id = b.batch_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.name, i.item_name
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows;
}

export async function listMovements(filters: {
  branchId?: number | null;
  itemId?: string | null;
  documentReference?: string | null;
  limit?: number;
}) {
  const params: any[] = [];
  const where: string[] = [];
  if (filters.branchId) {
    params.push(filters.branchId);
    where.push(`(sl.branch_id = $${params.length} OR dl.branch_id = $${params.length})`);
  }
  if (filters.itemId) {
    params.push(filters.itemId);
    where.push(`m.item_id = $${params.length}`);
  }
  if (filters.documentReference) {
    params.push(filters.documentReference);
    where.push(`m.document_reference = $${params.length}`);
  }
  params.push(Math.min(Math.max(filters.limit || 200, 1), 500));

  const result = await db.query(
    `
      SELECT m.*, i.sku, i.item_name,
             sl.name AS source_location_name,
             dl.name AS destination_location_name
      FROM inventory_movements m
      JOIN inventory_items i ON i.id = m.item_id
      LEFT JOIN inventory_locations sl ON sl.id = m.source_location_id
      LEFT JOIN inventory_locations dl ON dl.id = m.destination_location_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY m.created_at DESC
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows;
}

export async function listReservations(filters: {
  branchId?: number | null;
  status?: string | null;
  limit?: number;
}) {
  const params: any[] = [];
  const where: string[] = [];
  if (filters.branchId) {
    params.push(filters.branchId);
    where.push(`l.branch_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`r.status = $${params.length}`);
  }
  params.push(Math.min(Math.max(filters.limit || 200, 1), 500));

  const result = await db.query(
    `
      SELECT r.*, i.sku, i.item_name, l.name AS location_name, l.branch_id
      FROM inventory_reservations r
      JOIN inventory_items i ON i.id = r.item_id
      JOIN inventory_locations l ON l.id = r.location_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY r.created_at DESC
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows;
}

export async function listAlerts(filters: {
  branchId?: number | null;
  status?: string | null;
  limit?: number;
}) {
  const params: any[] = [];
  const where: string[] = [];
  if (filters.branchId) {
    params.push(filters.branchId);
    where.push(`a.branch_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`a.status = $${params.length}`);
  }
  params.push(Math.min(Math.max(filters.limit || 100, 1), 500));

  const result = await db.query(
    `
      SELECT a.*, i.sku, i.item_name, l.name AS location_name
      FROM inventory_alerts a
      LEFT JOIN inventory_items i ON i.id = a.item_id
      LEFT JOIN inventory_locations l ON l.id = a.location_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.created_at DESC
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows;
}

export async function listLocations(filters: { branchId?: number | null; type?: string | null }) {
  const params: any[] = [];
  const where: string[] = ['is_active = TRUE'];
  if (filters.branchId) {
    params.push(filters.branchId);
    where.push(`(branch_id = $${params.length} OR branch_id IS NULL)`);
  }
  if (filters.type) {
    params.push(filters.type);
    where.push(`location_type = $${params.length}`);
  }
  const result = await db.query(
    `
      SELECT *
      FROM inventory_locations
      WHERE ${where.join(' AND ')}
      ORDER BY location_type, location_name
    `,
    params
  );
  return result.rows;
}

export async function recomputeBalances(filters: {
  branchId?: number | null;
  actorId: string;
}) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const params: any[] = [];
    let branchWhere = '';
    if (filters.branchId) {
      params.push(filters.branchId);
      branchWhere = `WHERE l.branch_id = $${params.length}`;
    }

    const pairs = await client.query(
      `
        SELECT DISTINCT m.item_id, loc.id AS location_id, m.batch_id
        FROM inventory_movements m
        JOIN inventory_locations loc ON loc.id IN (m.source_location_id, m.destination_location_id)
        JOIN inventory_locations l ON l.id = loc.id
        ${branchWhere}
      `,
      params
    );

    const balances: JsonRecord[] = [];
    for (const row of pairs.rows) {
      balances.push(await upsertBalance(client, row.item_id, row.location_id, row.batch_id, 0, null));
    }

    await insertAudit(client, {
      branchId: filters.branchId ?? null,
      actorId: filters.actorId,
      actionType: 'balances.recomputed',
      entityType: 'inventory_balances',
      reason: 'Manual inventory balance recompute',
      afterValue: { count: balances.length }
    });

    await client.query('COMMIT');
    return balances;
  } catch (error) {
    logger.error('Inventory balance recompute failed', error);
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
