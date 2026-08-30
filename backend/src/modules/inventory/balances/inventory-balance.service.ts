import { PoolClient } from 'pg';
import { InventoryDomainError } from '../shared/inventory-domain.error';
import { InventoryPostingLocationInput } from '../shared/inventory-posting.types';

type LockedBalance = {
  available_quantity: number;
  current_quantity: number;
  id: string;
  reserved_quantity: number;
};

const shouldTrackBalance = (locationType: string): boolean => {
  return !['supplier', 'customer', 'external'].includes(locationType);
};

const codeForLocation = (input: InventoryPostingLocationInput): string => {
  if (input.locationCode) return input.locationCode;
  const branchPart = input.branchId != null ? `${input.branchId}` : 'SYS';
  switch (input.locationType) {
    case 'branch_store':
      return `BRANCH-${branchPart}-STORE`;
    case 'central_store':
      return `CENTRAL-${branchPart}-STORE`;
    case 'department':
      return `DEPT-${branchPart}-${String(input.departmentCode || 'GEN').toUpperCase()}`;
    case 'pos_outlet':
      return `OUTLET-${branchPart}-${String(input.outletId || 'GEN').toUpperCase()}`;
    default:
      return `${String(input.locationType).toUpperCase()}-${branchPart}`;
  }
};

const nameForLocation = (input: InventoryPostingLocationInput): string => {
  if (input.locationName) return input.locationName;
  if (input.locationType === 'branch_store') return `Branch Store ${input.branchId ?? ''}`.trim();
  if (input.locationType === 'central_store') return `Central Store ${input.branchId ?? ''}`.trim();
  if (input.locationType === 'department') return `Department ${input.departmentCode || ''}`.trim();
  return codeForLocation(input);
};

export class InventoryBalanceService {
  static async ensureCatalogItem(
    client: PoolClient,
    input: { itemName?: string | null; itemSku: string; unitCost?: number | null },
  ) {
    const existing = await client.query<{
      id: string;
      item_name: string;
      sku: string;
    }>(
      `
        SELECT id, sku, item_name
        FROM inventory_items
        WHERE sku = $1 OR id::text = $1
        LIMIT 1
      `,
      [input.itemSku],
    );

    if (existing.rows[0]) {
      try {
        await client.query(
          `
            INSERT INTO inventory_item_catalog (source_table, source_item_key, sku, item_name, default_unit_cost)
            VALUES ('inventory_items', $1, $1, $2, $3)
            ON CONFLICT (source_table, source_item_key) DO NOTHING
          `,
          [existing.rows[0].sku, existing.rows[0].item_name, input.unitCost ?? 0],
        );
      } catch (_) {}
      return existing.rows[0];
    }

    const catalogLookup = await client.query<{
      description: string | null;
      item_name: string | null;
      unit: string | null;
    }>(
      `
        SELECT
          COALESCE(item_name, description, $1) AS item_name,
          description,
          COALESCE(unit_of_measure, unit, 'units') AS unit
        FROM simple_items
        WHERE sku = $1
        LIMIT 1
      `,
      [input.itemSku],
    ).catch(async () => ({ rows: [] as any[] }));

    const source = (catalogLookup.rows[0] || {}) as {
      description?: string | null;
      item_name?: string | null;
      unit?: string | null;
    };

    const insert = await client.query<{ id: string; sku: string; item_name: string }>(
      `
        INSERT INTO inventory_items (
          sku,
          item_name,
          unit,
          cost_price
        )
        VALUES ($1, $2, COALESCE($3, 'units'), COALESCE($4, 0))
        RETURNING id, sku, item_name
      `,
      [
        input.itemSku,
        source.item_name || input.itemName || input.itemSku,
        source.unit || 'units',
        input.unitCost ?? 0,
      ],
    );

    try {
      await client.query(
        `
          INSERT INTO inventory_item_catalog (source_table, source_item_key, sku, item_name, default_unit_cost)
          VALUES ('inventory_items', $1, $1, $2, $3)
          ON CONFLICT (source_table, source_item_key) DO NOTHING
        `,
        [insert.rows[0].sku, insert.rows[0].item_name, input.unitCost ?? 0],
      );
    } catch (_) {}

    return insert.rows[0];
  }

  static async ensureLocation(client: PoolClient, input: InventoryPostingLocationInput) {
    const locationCode = codeForLocation(input);
    const found = await client.query<{ id: string; location_code: string }>(
      `
        SELECT id, location_code
        FROM inventory_locations
        WHERE location_code = $1
           OR (branch_id IS NOT DISTINCT FROM $2 AND location_type = $3 AND is_active = true)
        ORDER BY CASE WHEN location_code = $1 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [locationCode, input.branchId ?? null, input.locationType],
    );

    if (found.rows[0]) {
      return { id: found.rows[0].id, locationCode: found.rows[0].location_code || locationCode };
    }

    const created = await client.query<{ id: string }>(
      `
        INSERT INTO inventory_locations (
          branch_id,
          location_code,
          name,
          location_name,
          location_type,
          department_code,
          outlet_id,
          metadata
        )
        VALUES ($1, $2, $3, $3, $4, $5, $6::uuid, $7::jsonb)
        RETURNING id
      `,
      [
        input.branchId ?? null,
        locationCode,
        nameForLocation(input),
        input.locationType,
        input.departmentCode ?? null,
        input.outletId ?? null,
        JSON.stringify(input.metadata || {}),
      ],
    );

    return { id: created.rows[0].id, locationCode };
  }

  static async lockBalance(client: PoolClient, itemId: string, locationId: string): Promise<LockedBalance> {
    const existing = await client.query<LockedBalance>(
      `
        SELECT id, current_quantity, reserved_quantity, available_quantity
        FROM inventory_balances
        WHERE item_id = $1::uuid
          AND location_id = $2::uuid
          AND batch_id IS NULL
        FOR UPDATE
      `,
      [itemId, locationId],
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    await client.query(
      `
        INSERT INTO inventory_balances (item_id, location_id, current_quantity, reserved_quantity, unit_cost)
        VALUES ($1::uuid, $2::uuid, 0, 0, 0)
        ON CONFLICT DO NOTHING
      `,
      [itemId, locationId],
    );

    const locked = await client.query<LockedBalance>(
      `
        SELECT id, current_quantity, reserved_quantity, available_quantity
        FROM inventory_balances
        WHERE item_id = $1::uuid
          AND location_id = $2::uuid
          AND batch_id IS NULL
        FOR UPDATE
      `,
      [itemId, locationId],
    );

    return locked.rows[0];
  }

  static async assertAvailability(
    client: PoolClient,
    input: {
      allowOverride?: boolean;
      itemId: string;
      locationId: string;
      quantity: number;
    },
  ) {
    const balance = await this.lockBalance(client, input.itemId, input.locationId);
    if (input.allowOverride) return balance;
    if (Number(balance.available_quantity || 0) < input.quantity) {
      throw new InventoryDomainError(
        'INSUFFICIENT_AVAILABLE_QUANTITY',
        'Requested quantity exceeds available quantity',
        409,
        {
          available_quantity: Number(balance.available_quantity || 0),
          current_quantity: Number(balance.current_quantity || 0),
          requested_quantity: input.quantity,
        },
      );
    }
    return balance;
  }

  static async applyBalanceDelta(
    client: PoolClient,
    input: {
      deltaCurrent: number;
      deltaReserved?: number;
      itemId: string;
      lastMovementId?: string | null;
      locationId: string;
      unitCost?: number | null;
    },
  ) {
    const locked = await this.lockBalance(client, input.itemId, input.locationId);
    const nextCurrent = Number(locked.current_quantity || 0) + Number(input.deltaCurrent || 0);
    const nextReserved = Number(locked.reserved_quantity || 0) + Number(input.deltaReserved || 0);

    if (nextCurrent < 0) {
      throw new InventoryDomainError('NEGATIVE_STOCK_BLOCKED', 'Inventory posting would create negative stock', 409, {
        current_quantity: Number(locked.current_quantity || 0),
        delta_current: Number(input.deltaCurrent || 0),
      });
    }

    if (nextReserved < 0) {
      throw new InventoryDomainError('NEGATIVE_STOCK_BLOCKED', 'Inventory posting would create negative reserved stock', 409, {
        reserved_quantity: Number(locked.reserved_quantity || 0),
        delta_reserved: Number(input.deltaReserved || 0),
      });
    }

    await client.query(
      `
        UPDATE inventory_balances
        SET
          current_quantity = $2,
          reserved_quantity = $3,
          unit_cost = COALESCE($4, unit_cost),
          last_movement_id = COALESCE($5::uuid, last_movement_id),
          updated_at = NOW()
        WHERE id = $1::uuid
      `,
      [
        locked.id,
        nextCurrent,
        nextReserved,
        input.unitCost ?? null,
        input.lastMovementId ?? null,
      ],
    );

    const after = await this.lockBalance(client, input.itemId, input.locationId);
    return {
      after: Number(after.current_quantity || 0),
      afterAvailable: Number(after.available_quantity || 0),
      before: Number(locked.current_quantity || 0),
    };
  }

  static async writeBranchStockProjection(
    client: PoolClient,
    input: {
      branchId?: number | null;
      deltaQuantity: number;
      itemName?: string | null;
      itemSku: string;
      referenceId?: string | null;
      referenceNumber?: string | null;
      referenceType?: string | null;
      userId: string;
    },
  ) {
    if (input.branchId == null || input.deltaQuantity === 0) return null;

    await client.query(
      `
        INSERT INTO branch_stock (
          branch_id,
          item_sku,
          quantity,
          created_at,
          updated_at,
          last_stock_in,
          last_stock_out
        )
        VALUES (
          $1,
          $2,
          GREATEST($3, 0),
          NOW(),
          NOW(),
          CASE WHEN $3 > 0 THEN NOW() ELSE NULL END,
          CASE WHEN $3 < 0 THEN NOW() ELSE NULL END
        )
        ON CONFLICT (branch_id, item_sku)
        DO UPDATE SET
          quantity = GREATEST(branch_stock.quantity + EXCLUDED.quantity, 0),
          updated_at = NOW(),
          last_stock_in = CASE WHEN EXCLUDED.quantity > 0 THEN NOW() ELSE branch_stock.last_stock_in END,
          last_stock_out = CASE WHEN EXCLUDED.quantity < 0 THEN NOW() ELSE branch_stock.last_stock_out END
      `,
      [input.branchId, input.itemSku, Math.trunc(input.deltaQuantity)],
    );

    await client.query(
      `
        UPDATE simple_items
        SET quantity = GREATEST(COALESCE(quantity, 0) + $1, 0),
            last_updated = NOW(),
            updated_at = NOW()
        WHERE (sku = $2 OR item_sku = $2)
          AND (branch_id = $3 OR branch_id IS NULL)
      `,
      [input.deltaQuantity, input.itemSku, input.branchId],
    );

    await client.query(
      `
        UPDATE inventory_items
        SET quantity = GREATEST(COALESCE(quantity, 0) + $1, 0),
            updated_at = NOW()
        WHERE sku = $2
          AND (branch_id = $3 OR branch_id IS NULL)
      `,
      [input.deltaQuantity, input.itemSku, input.branchId],
    ).catch(() => {});

    const stock = await client.query<{ quantity: number }>(
      `
        SELECT quantity
        FROM branch_stock
        WHERE branch_id = $1
          AND item_sku = $2
      `,
      [input.branchId, input.itemSku],
    );

    await client.query(
      `
        INSERT INTO branch_stock_movements (
          branch_id,
          item_sku,
          movement_type,
          quantity,
          previous_stock,
          new_stock,
          reference_type,
          reference_id,
          reference_number,
          notes,
          performed_by
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          GREATEST($5 - $4, 0),
          $5,
          $6,
          $7::uuid,
          $8,
          $9,
          $10::uuid
        )
      `,
      [
        input.branchId,
        input.itemSku,
        input.deltaQuantity >= 0 ? 'STOCK_IN' : 'STOCK_OUT',
        Math.abs(Math.trunc(input.deltaQuantity)),
        Number(stock.rows[0]?.quantity || 0),
        input.referenceType ?? 'inventory_document',
        input.referenceId ?? null,
        input.referenceNumber ?? null,
        input.itemName || input.itemSku,
        input.userId,
      ],
    );

    return Number(stock.rows[0]?.quantity || 0);
  }

  static tracksBalance(locationType: string) {
    return shouldTrackBalance(locationType);
  }
}
