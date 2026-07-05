import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import * as BranchInventoryService from './branch-inventory.service';
import * as InventoryFoundationService from './inventory-foundation.service';

type JsonRecord = Record<string, any>;

const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const textValue = (value: unknown, fallback = ''): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const documentNumber = (prefix: string): string => {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${day}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
};

const classifyVariance = (quantityVariance: number, valueVariance = 0): 'small' | 'medium' | 'large' | 'critical' => {
  const quantity = Math.abs(quantityVariance);
  const value = Math.abs(valueVariance);
  if (quantity >= 20 || value >= 10000) return 'critical';
  if (quantity >= 10 || value >= 5000) return 'large';
  if (quantity >= 3 || value >= 1000) return 'medium';
  return 'small';
};

const outletStatusFor = (row: JsonRecord): string => {
  const variance = numberValue(row.variance);
  const system = numberValue(row.expected_closing_stock ?? row.system_closing_stock);
  const actual = row.actual_closing_stock ?? row.physical_count;
  if (Math.abs(variance) >= Math.max(5, system * 0.2)) return 'critical_variance';
  if (variance < 0) return 'shortage';
  if (variance > 0) return 'overage';
  if (system <= 0 || numberValue(actual, system) <= 0) return 'out_of_stock';
  if (system <= 5 || numberValue(actual, system) <= 5) return 'low_stock';
  return 'normal';
};

const outletStockStatusFor = (row: JsonRecord): string => {
  const current = numberValue(row.current_stock ?? row.quantity);
  const reorder = numberValue(row.reorder_level ?? row.par_level ?? row.minimum_stock);
  const maxProducible = row.max_producible_quantity === null || row.max_producible_quantity === undefined
    ? null
    : numberValue(row.max_producible_quantity);
  if (current <= 0 && maxProducible !== null && maxProducible > 0) return 'production_required';
  if (current <= 0) return 'out_of_stock';
  if ((reorder > 0 && current <= reorder) || current <= 5) return 'low_stock';
  return 'available';
};

const normaliseBranchOutletName = (value: unknown): string =>
  textValue(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function removeCrossBranchOutletStockRows(rows: JsonRecord[]): Promise<JsonRecord[]> {
  if (!rows.length) return rows;

  try {
    const branchResult = await db.query('SELECT id, name FROM branches');
    const branches = branchResult.rows
      .map((branch: JsonRecord) => ({
        id: Number(branch.id),
        name: normaliseBranchOutletName(branch.name)
      }))
      .filter((branch: JsonRecord) => Number.isFinite(branch.id) && branch.name.length >= 4);
    const branchNameById = new Map(branches.map((branch: JsonRecord) => [branch.id, branch.name]));

    return rows.filter((row) => {
      const outletBranchId = Number(row.branch_id);
      const outletName = normaliseBranchOutletName(row.outlet_name ?? row.name);
      const ownBranchName = branchNameById.get(outletBranchId) || '';
      const nameWithoutOwnBranch = ownBranchName
        ? outletName.replace(ownBranchName, '').trim()
        : outletName;

      if (nameWithoutOwnBranch.includes('kyogong') && !ownBranchName.includes('kyogong')) {
        return false;
      }
      if (nameWithoutOwnBranch.includes('bomet') && !ownBranchName.includes('bomet')) {
        return false;
      }

      return !branches.some((branch: JsonRecord) =>
        branch.id !== outletBranchId && nameWithoutOwnBranch.includes(branch.name)
      );
    });
  } catch {
    return rows;
  }
}

const branchStoreLocation = (branchId: number) => ({
  branchId,
  locationType: 'branch_store' as const,
  locationCode: `B${branchId}-BRANCH-STORE`,
  locationName: `Branch ${branchId} Store`
});

const productionLocation = (branchId: number, area?: string) => ({
  branchId,
  locationType: 'production' as const,
  locationCode: `B${branchId}-PRODUCTION-${textValue(area, 'GENERAL').replace(/[^a-z0-9]+/gi, '-').toUpperCase()}`,
  locationName: `${textValue(area, 'Production')} Production`
});

const adjustmentLocation = (branchId: number) => ({
  branchId,
  locationType: 'adjustment' as const,
  locationCode: `B${branchId}-ADJUSTMENT`,
  locationName: `Branch ${branchId} Adjustment`
});

const outletLocation = (outlet: JsonRecord) => ({
  branchId: Number(outlet.branch_id),
  locationType: 'pos_outlet' as const,
  outletId: outlet.id,
  locationCode: `B${outlet.branch_id}-POS-${textValue(outlet.outlet_type, 'OUTLET').replace(/[^a-z0-9]+/gi, '-').toUpperCase()}`,
  locationName: outlet.name || `POS Outlet ${outlet.id}`
});

async function getSimpleItem(sku: string): Promise<JsonRecord> {
  const result = await db.query(
    `
      SELECT sku, item_name, description, category, unit_of_measure, cost_price, store_type
      FROM simple_items
      WHERE sku = $1
      LIMIT 1
    `,
    [sku]
  );
  return result.rows[0] || { sku, item_name: sku, unit_of_measure: 'units', cost_price: 0 };
}

async function getOutlet(outletId: string): Promise<JsonRecord> {
  const result = await db.query('SELECT * FROM pos_outlets WHERE id = $1', [outletId]);
  if (!result.rows[0]) throw new AppError('POS outlet not found', 404);
  return result.rows[0];
}

async function getOutletItem(outletItemId: string | null | undefined): Promise<JsonRecord | null> {
  if (!outletItemId) return null;
  const result = await db.query('SELECT * FROM pos_outlet_items WHERE id = $1', [outletItemId]);
  return result.rows[0] || null;
}

async function buildRecipeInputsFromOutputs(outputs: JsonRecord[]): Promise<JsonRecord[]> {
  const inputsBySku = new Map<string, JsonRecord>();

  for (const output of outputs) {
    const outletItem = await getOutletItem(output.outlet_item_id ?? output.outletItemId);
    const outputQuantity = numberValue(output.quantity_produced ?? output.output_quantity ?? output.quantity);
    if (!outletItem || outputQuantity <= 0) continue;

    const sourceTable = textValue(outletItem.source_table);
    const sourceItemId = textValue(outletItem.source_item_id);
    let matchedBomRecipe = false;

    if (sourceTable === 'restaurant_menu_items' && sourceItemId) {
      const recipeResult = await db.query(
        `
          SELECT
            r.id AS recipe_id,
            r.name AS recipe_name,
            ri.item_sku,
            ri.item_name,
            ri.quantity_required,
            ri.unit,
            COALESCE(ii.default_unit_cost, 0) AS unit_cost
          FROM recipes r
          JOIN recipe_items ri ON ri.recipe_id = r.id
          LEFT JOIN public.inventory_items ii ON ii.sku = ri.item_sku
          WHERE r.menu_item_id = $1::uuid
            AND COALESCE(r.status, 'active') = 'active'
          ORDER BY ri.item_name
        `,
        [sourceItemId]
      );

      if (recipeResult.rows.length) {
        matchedBomRecipe = true;
        output.metadata = {
          ...(output.metadata || {}),
          recipe_id: recipeResult.rows[0].recipe_id,
          menu_item_id: sourceItemId,
          recipe_name: recipeResult.rows[0].recipe_name
        };

        for (const ingredient of recipeResult.rows) {
          const sku = textValue(ingredient.item_sku);
          const quantity = outputQuantity * numberValue(ingredient.quantity_required);
          if (!sku || quantity <= 0) continue;

          const existing = inputsBySku.get(sku);
          if (existing) {
            existing.quantity = numberValue(existing.quantity) + quantity;
            continue;
          }

          inputsBySku.set(sku, {
            item_sku: sku,
            item_name: ingredient.item_name || sku,
            quantity,
            unit: ingredient.unit_of_measure || 'units',
            unit_cost: numberValue(ingredient.unit_cost),
            metadata: {
              source: 'recipe_auto_deduction',
              recipe_id: ingredient.recipe_id,
              output_item_id: outletItem.id,
              output_item_name: outletItem.name || outletItem.sku,
              output_quantity: outputQuantity
            }
          });
        }
      } else {
        output.metadata = { ...(output.metadata || {}), menu_item_id: sourceItemId, recipe_id: null };
      }
    }

    if (matchedBomRecipe) continue;

    // No menu-item BOM — fall back to a single-ingredient yield recipe
    // configured in Food Control (e.g. raw potatoes -> chips). Without this,
    // a Food Control recipe has no effect on Outlet Production's deduction.
    const yieldRecipeResult = await db.query(
      `
        SELECT id, raw_item_sku, raw_item_name, raw_quantity, raw_unit, produced_quantity
        FROM kitchen_production_recipes
        WHERE is_active = true
          AND (pos_outlet_item_id = $1::uuid OR produced_item_sku = $2)
        ORDER BY (pos_outlet_item_id = $1::uuid) DESC
        LIMIT 1
      `,
      [outletItem.id, outletItem.sku || null]
    );
    const yieldRecipe = yieldRecipeResult.rows[0];
    if (!yieldRecipe || numberValue(yieldRecipe.produced_quantity) <= 0 || !textValue(yieldRecipe.raw_item_sku)) {
      continue;
    }

    const sku = textValue(yieldRecipe.raw_item_sku);
    const quantity = outputQuantity * (numberValue(yieldRecipe.raw_quantity) / numberValue(yieldRecipe.produced_quantity));
    if (quantity <= 0) continue;

    output.metadata = { ...(output.metadata || {}), kitchen_production_recipe_id: yieldRecipe.id };
    const existing = inputsBySku.get(sku);
    if (existing) {
      existing.quantity = numberValue(existing.quantity) + quantity;
      continue;
    }

    inputsBySku.set(sku, {
      item_sku: sku,
      item_name: yieldRecipe.raw_item_name || sku,
      quantity,
      unit: yieldRecipe.raw_unit || 'units',
      unit_cost: 0,
      metadata: {
        source: 'kitchen_production_recipe_auto_deduction',
        kitchen_production_recipe_id: yieldRecipe.id,
        output_item_id: outletItem.id,
        output_item_name: outletItem.name || outletItem.sku,
        output_quantity: outputQuantity
      }
    });
  }

  return Array.from(inputsBySku.values());
}

const tableColumnCache = new Map<string, Set<string>>();

async function tableColumns(tableName: string): Promise<Set<string>> {
  const cached = tableColumnCache.get(tableName);
  if (cached) return cached;

  const result = await db.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName]
  );
  const columns = new Set(result.rows.map((row: JsonRecord) => String(row.column_name)));
  tableColumnCache.set(tableName, columns);
  return columns;
}

async function enrichOutletStockRows(rows: JsonRecord[]): Promise<JsonRecord[]> {
  if (!rows.length) return rows;

  const menuItemIds = Array.from(new Set(rows
    .filter((row) => row.source_table === 'restaurant_menu_items' && textValue(row.source_item_id))
    .map((row) => String(row.source_item_id))));

  const recipesByMenuItemId = new Map<string, JsonRecord>();
  if (menuItemIds.length) {
    const recipeResult = await db.query(
      `
        SELECT
          r.*,
          COALESCE(
            json_agg(
              jsonb_build_object(
                'id', ri.id,
                'item_sku', ri.item_sku,
                'item_name', ri.item_name,
                'quantity_per_portion', ri.quantity_required,
                'unit_of_measure', ri.unit,
                'unit_cost', COALESCE(ii.default_unit_cost, 0),
                'total_cost', ri.quantity_required * COALESCE(ii.default_unit_cost, 0)
              )
              ORDER BY ri.item_name
            ) FILTER (WHERE ri.id IS NOT NULL),
            '[]'::json
          ) AS recipe_ingredients
        FROM recipes r
        LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
        LEFT JOIN public.inventory_items ii ON ii.sku = ri.item_sku
        WHERE r.menu_item_id = ANY($1::uuid[])
          AND COALESCE(r.status, 'active') = 'active'
        GROUP BY r.id
      `,
      [menuItemIds]
    );
    for (const recipe of recipeResult.rows) {
      recipesByMenuItemId.set(String(recipe.menu_item_id), recipe);
    }
  }

  const branchIds = Array.from(new Set(rows.map((row) => Number(row.branch_id)).filter(Number.isFinite)));
  const ingredientSkus = Array.from(new Set(
    Array.from(recipesByMenuItemId.values())
      .flatMap((recipe) => Array.isArray(recipe.recipe_ingredients) ? recipe.recipe_ingredients : [])
      .map((ingredient: JsonRecord) => textValue(ingredient.item_sku))
      .filter(Boolean)
  ));

  const branchStockByKey = new Map<string, number>();
  if (branchIds.length && ingredientSkus.length) {
    const stockResult = await db.query(
      `
        SELECT branch_id, item_sku, quantity
        FROM branch_stock
        WHERE branch_id = ANY($1::int[])
          AND item_sku = ANY($2::text[])
      `,
      [branchIds, ingredientSkus]
    );
    for (const stock of stockResult.rows) {
      branchStockByKey.set(`${stock.branch_id}:${stock.item_sku}`, numberValue(stock.quantity));
    }
  }

  return rows.map((row) => {
    const recipe = row.source_table === 'restaurant_menu_items'
      ? recipesByMenuItemId.get(String(row.source_item_id))
      : null;
    const ingredients = recipe && Array.isArray(recipe.recipe_ingredients)
      ? recipe.recipe_ingredients
      : [];
    const ingredientCosts = ingredients.reduce(
      (sum: number, ingredient: JsonRecord) =>
        sum + numberValue(ingredient.quantity_per_portion) * numberValue(ingredient.unit_cost),
      0
    );
    const recipeUnitCost = numberValue(recipe?.standard_cost) || ingredientCosts;
    let maxProducibleQuantity: number | null = null;
    if (ingredients.length) {
      for (const ingredient of ingredients) {
        const required = numberValue(ingredient.quantity_per_portion);
        if (required <= 0) continue;
        const available = branchStockByKey.get(`${row.branch_id}:${ingredient.item_sku}`) || 0;
        const possible = Math.floor(available / required);
        maxProducibleQuantity = maxProducibleQuantity === null
          ? possible
          : Math.min(maxProducibleQuantity, possible);
      }
    }

    const sellingPrice = numberValue(row.selling_price);
    const costPrice = numberValue(row.cost_price) || recipeUnitCost;
    const grossProfit = sellingPrice - costPrice;
    const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
    const enriched = {
      ...row,
      menu_mapping_status: row.source_table && row.source_item_id ? 'linked' : 'manual',
      linked_menu_table: row.source_table || null,
      linked_menu_item_id: row.source_item_id || null,
      recipe_id: recipe?.id || null,
      recipe_name: recipe?.recipe_name || recipe?.menu_item_name || null,
      recipe_code: recipe?.recipe_code || null,
      recipe_ingredients: ingredients,
      recipe_ingredient_count: ingredients.length,
      recipe_unit_cost: recipeUnitCost,
      computed_unit_cost: costPrice,
      gross_profit: grossProfit,
      gross_margin: grossMargin,
      max_producible_quantity: maxProducibleQuantity,
      production_required: numberValue(row.current_stock) <= 0 && maxProducibleQuantity !== null && maxProducibleQuantity > 0
    };
    return {
      ...enriched,
      stock_status: outletStockStatusFor(enriched)
    };
  });
}

async function seedFoundationBranchBalance(branchId: number, item: JsonRecord, actorId: string): Promise<void> {
  const balance = await db.query(
    `
      SELECT b.current_quantity
      FROM inventory_balances b
      JOIN inventory_items i ON i.id = b.item_id
      JOIN inventory_locations l ON l.id = b.location_id
      WHERE l.branch_id = $1
        AND l.location_type = 'branch_store'
        AND i.sku = $2
      ORDER BY b.updated_at DESC
      LIMIT 1
    `,
    [branchId, item.sku]
  );
  if (numberValue(balance.rows[0]?.current_quantity) > 0) return;

  const legacy = await db.query(
    'SELECT quantity FROM branch_stock WHERE branch_id = $1 AND item_sku = $2 LIMIT 1',
    [branchId, item.sku]
  );
  const legacyQty = numberValue(legacy.rows[0]?.quantity);
  if (legacyQty <= 0) return;

  await InventoryFoundationService.recordMovement({
    movementType: 'purchase_receipt',
    item: {
      sku: item.sku,
      itemName: item.item_name || item.sku,
      category: item.category,
      unit: item.unit_of_measure || item.unit || 'units',
      defaultUnitCost: numberValue(item.cost_price)
    },
    sourceLocation: {
      branchId,
      locationType: 'external',
      locationCode: `B${branchId}-LEGACY-SEED`,
      locationName: `Branch ${branchId} Legacy Opening`
    },
    destinationLocation: branchStoreLocation(branchId),
    quantity: legacyQty,
    unitCost: numberValue(item.cost_price),
    reason: 'Legacy branch stock seeded into inventory foundation before controlled inventory movement',
    documentType: 'legacy_stock_seed',
    documentReference: `branch_stock:${branchId}:${item.sku}`,
    documentNumber: `LEGACY-${branchId}-${item.sku}`,
    reversible: false,
    metadata: { source: 'branch_stock', branch_id: branchId, sku: item.sku }
  }, actorId);
}

export async function listOutletStock(filters: {
  branchId?: number | null;
  outletId?: string | null;
  search?: string | null;
  limit?: number;
}) {
  const params: any[] = [];
  const where: string[] = ['o.is_active = true', 'i.is_active = true'];
  if (filters.branchId !== null && filters.branchId !== undefined) {
    params.push(filters.branchId);
    where.push(`o.branch_id = $${params.length}`);
  }
  if (filters.outletId) {
    params.push(filters.outletId);
    where.push(`o.id = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`(i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length} OR o.name ILIKE $${params.length})`);
  }
  params.push(Math.min(Math.max(filters.limit || 200, 1), 500));

  const result = await db.query(
    `
      SELECT
        i.*,
        o.branch_id,
        o.name AS outlet_name,
        o.outlet_type,
        COALESCE(c.sold_quantity, 0) AS shift_sales_quantity,
        0::numeric AS shift_produced_quantity,
        0::numeric AS shift_wastage_quantity
      FROM pos_outlet_items i
      JOIN pos_outlets o ON o.id = i.outlet_id
      LEFT JOIN LATERAL (
        SELECT sold_quantity
        FROM pos_shift_stock_counts
        WHERE outlet_item_id = i.id
        ORDER BY updated_at DESC
        LIMIT 1
      ) c ON true
      WHERE ${where.join(' AND ')}
      ORDER BY o.name, i.category, i.name
      LIMIT $${params.length}
    `,
    params
  );
  const branchSafeRows = await removeCrossBranchOutletStockRows(result.rows);
  return enrichOutletStockRows(branchSafeRows);
}

export async function postProductionRun(input: JsonRecord, actorId: string) {
  const branchId = Number(input.branch_id ?? input.branchId);
  if (!Number.isFinite(branchId)) throw new AppError('Branch is required', 400);

  const destinationOutletId = textValue(input.destination_outlet_id ?? input.destinationOutletId);
  if (!destinationOutletId) throw new AppError('Destination outlet is required', 400);
  const outlet = await getOutlet(destinationOutletId);
  if (Number(outlet.branch_id) !== branchId) throw new AppError('Destination outlet belongs to another branch', 403);

  let inputs = Array.isArray(input.inputs)
    ? input.inputs
    : Array.isArray(input.raw_items)
      ? input.raw_items
      : [input.raw_item || input.raw_input].filter((row: any) =>
        row?.item_sku || row?.raw_sku || row?.sku
      );
  const outputs = Array.isArray(input.outputs)
    ? input.outputs
    : [input.output_item || input.output || input].filter((row: any) => row?.output_sku || row?.item_sku || row?.sku || row?.outlet_item_id);

  if (!inputs.length && outputs.length) {
    inputs = await buildRecipeInputsFromOutputs(outputs);
  }

  if (!outputs.length) throw new AppError('At least one output item is required', 400);

  const productionNumber = input.production_number || input.productionNumber || documentNumber('PRD');
  const productionArea = textValue(input.production_area ?? input.productionArea, 'branch_store');
  const batchReference = textValue(input.batch_reference ?? input.batchReference, productionNumber);

  // Resolve active cashier shift if not explicitly provided
  let shiftId = input.shift_id ?? input.shiftId ?? null;
  if (!shiftId && destinationOutletId) {
    const activeShiftResult = await db.query(
      `
        SELECT id FROM pos_outlet_shifts
        WHERE outlet_id = $1 AND status = 'open'
        ORDER BY opened_at DESC
        LIMIT 1
      `,
      [destinationOutletId]
    );
    if (activeShiftResult.rows[0]) {
      shiftId = activeShiftResult.rows[0].id;
    }
  }

  const created = await db.query(
    `
      INSERT INTO inventory_production_runs (
        production_number, branch_id, production_date, production_area, destination_outlet_id,
        shift_id, batch_reference, operator_id, status, remarks, posted_by, created_by
      )
      VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5::uuid, $6::uuid, $7, $8::uuid, 'posted', $9, $8::uuid, $8::uuid)
      RETURNING *
    `,
    [
      productionNumber,
      branchId,
      input.production_date ?? input.productionDate ?? null,
      productionArea,
      destinationOutletId,
      shiftId,
      batchReference,
      actorId,
      input.remarks ?? input.notes ?? null
    ]
  );
  const run = created.rows[0];

  let totalInputCost = 0;
  let totalOutputValue = 0;
  const postedInputs: JsonRecord[] = [];
  const postedOutputs: JsonRecord[] = [];

  for (const row of inputs) {
    const sku = textValue(row.item_sku ?? row.raw_sku ?? row.sku);
    const quantity = numberValue(row.quantity_consumed ?? row.raw_quantity ?? row.quantity);
    if (!sku || quantity <= 0) throw new AppError('Input SKU and quantity are required', 400);
    const item = await getSimpleItem(sku);
    await seedFoundationBranchBalance(branchId, item, actorId);

    let movement: any = { movement: { id: null } };
    try {
      movement = await InventoryFoundationService.recordMovement({
        movementType: 'production_consumption',
        item: {
          sku,
          itemName: item.item_name || row.item_name || sku,
          category: item.category,
          unit: row.unit || item.unit_of_measure || 'units',
          defaultUnitCost: numberValue(row.unit_cost ?? item.cost_price)
        },
        sourceLocation: branchStoreLocation(branchId),
        destinationLocation: productionLocation(branchId, productionArea),
        quantity,
        unitCost: numberValue(row.unit_cost ?? item.cost_price),
        reason: `Production input consumed for ${productionNumber}`,
        documentType: 'production_run',
        documentReference: run.id,
        documentNumber: productionNumber,
        metadata: { production_run_id: run.id, batch_reference: batchReference }
      }, actorId);
    } catch (foundationErr: any) {
      logger.warn(`Foundation movement record failed for production input ${sku} (non-critical):`, foundationErr?.message);
    }

    await BranchInventoryService.updateBranchStock(
      branchId,
      sku,
      -quantity,
      'PRODUCTION_CONSUMPTION',
      actorId,
      'production_run',
      run.id,
      productionNumber,
      `Production input consumed for ${productionNumber}`
    );

    const unitCost = numberValue(row.unit_cost ?? item.cost_price);
    totalInputCost += quantity * unitCost;
    const inserted = await db.query(
      `
        INSERT INTO inventory_production_inputs (
          production_run_id, item_sku, item_name, quantity_consumed, unit, unit_cost, movement_id, batch_number, expiry_date, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, $8, $9::date, $10::jsonb)
        RETURNING *
      `,
      [
        run.id,
        sku,
        item.item_name || row.item_name || sku,
        quantity,
        row.unit || item.unit_of_measure || 'units',
        unitCost,
        movement.movement.id,
        row.batch_number ?? row.batchNumber ?? null,
        row.expiry_date ?? row.expiryDate ?? null,
        JSON.stringify(row.metadata || {})
      ]
    );
    postedInputs.push(inserted.rows[0]);
  }

  const totalOutputQuantity = outputs.reduce(
    (sum: number, row: JsonRecord) =>
      sum + numberValue(row.quantity_produced ?? row.output_quantity ?? row.quantity),
    0
  );
  const allocatedOutputUnitCost = totalOutputQuantity > 0
    ? totalInputCost / totalOutputQuantity
    : 0;

  for (const row of outputs) {
    const outletItem = await getOutletItem(row.outlet_item_id ?? row.outletItemId);
    const sku = textValue(row.item_sku ?? row.output_sku ?? row.sku ?? outletItem?.sku);
    const quantity = numberValue(row.quantity_produced ?? row.output_quantity ?? row.quantity);
    if (!sku || quantity <= 0) throw new AppError('Output SKU and quantity are required', 400);
    const explicitUnitCost = numberValue(row.unit_cost ?? row.unitCost);
    const existingCost = numberValue(outletItem?.cost_price);
    const unitCost = explicitUnitCost > 0
      ? explicitUnitCost
      : allocatedOutputUnitCost > 0
        ? allocatedOutputUnitCost
        : existingCost;
    const expectedQuantity = numberValue(row.expected_quantity ?? row.expectedQuantity);
    const yieldVariance = expectedQuantity > 0 ? quantity - expectedQuantity : 0;

    let movement: any = { movement: { id: null } };
    try {
      movement = await InventoryFoundationService.recordMovement({
        movementType: 'production_output',
        item: {
          sku,
          itemName: row.item_name || row.output_name || outletItem?.name || sku,
          category: row.category || outletItem?.category,
          unit: row.unit || outletItem?.unit || 'units',
          defaultUnitCost: unitCost,
          sourceTable: outletItem ? 'pos_outlet_items' : 'production_outputs',
          sourceItemKey: outletItem?.id || sku
        },
        sourceLocation: productionLocation(branchId, productionArea),
        destinationLocation: outletLocation(outlet),
        quantity,
        unitCost,
        reason: `Production output posted for ${productionNumber}`,
        documentType: 'production_run',
        documentReference: run.id,
        documentNumber: productionNumber,
        metadata: {
          production_run_id: run.id,
          batch_reference: batchReference,
          outlet_item_id: outletItem?.id || null,
          expected_quantity: expectedQuantity || null,
          actual_quantity: quantity,
          yield_variance: yieldVariance,
          yield_variance_reason: row.yield_variance_reason ?? row.yieldVarianceReason ?? null
        }
      }, actorId);
    } catch (foundationErr: any) {
      logger.warn(`Foundation movement record failed for production output ${sku} (non-critical):`, foundationErr?.message);
    }

    if (outletItem) {
      await db.query(
        `
          UPDATE pos_outlet_items
          SET cost_price = CASE WHEN $2 > 0 THEN $2 ELSE cost_price END,
              track_stock = true,
              updated_at = NOW()
          WHERE id = $1
        `,
        [outletItem.id, unitCost]
      );
      // Pool-aware + bar-ledger-aware credit (shared with Kitchen Shift
      // production posting) instead of a raw current_stock increment, so
      // pooled portions and bar-sourced items credit correctly here too.
      await BranchInventoryService.creditOutletItemStock(outletItem.id, quantity, shiftId);
      if (shiftId) {
        const countColumns = await tableColumns('pos_shift_stock_counts');
        const setClauses = [
          'additions = COALESCE(additions, 0) + $3',
          'system_closing_stock = COALESCE(opening_stock, 0) + COALESCE(additions, 0) + $3 - COALESCE(sold_quantity, 0)',
          'updated_at = NOW()'
        ];
        if (countColumns.has('produced_stock')) {
          setClauses.unshift('produced_stock = COALESCE(produced_stock, 0) + $3');
        }
        if (countColumns.has('expected_closing_stock')) {
          setClauses.splice(
            setClauses.length - 1,
            0,
            'expected_closing_stock = COALESCE(opening_stock, 0) + COALESCE(additions, 0) + $3 - COALESCE(sold_quantity, 0)'
          );
        }
        await db.query(
          `
            UPDATE pos_shift_stock_counts
            SET ${setClauses.join(', ')}
            WHERE shift_id = $1 AND outlet_item_id = $2
          `,
          [shiftId, outletItem.id, quantity]
        );
      }
    }

    totalOutputValue += quantity * unitCost;
    const inserted = await db.query(
      `
        INSERT INTO inventory_production_outputs (
          production_run_id, outlet_item_id, item_sku, item_name, quantity_produced, unit, unit_cost, movement_id, metadata
        )
        VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::uuid, $9::jsonb)
        RETURNING *
      `,
      [
        run.id,
        outletItem?.id || null,
        sku,
        row.item_name || row.output_name || outletItem?.name || sku,
        quantity,
        row.unit || outletItem?.unit || 'units',
        unitCost,
        movement.movement.id,
        JSON.stringify({
          ...(row.metadata || {}),
          expected_quantity: expectedQuantity || null,
          actual_quantity: quantity,
          yield_variance: yieldVariance,
          yield_variance_reason: row.yield_variance_reason ?? row.yieldVarianceReason ?? null
        })
      ]
    );
    postedOutputs.push(inserted.rows[0]);
  }

  const yieldPercentage = totalInputCost > 0 ? (totalOutputValue / totalInputCost) * 100 : 0;
  const varianceClassification = classifyVariance(0, totalOutputValue - totalInputCost);
  const updated = await db.query(
    `
      UPDATE inventory_production_runs
      SET total_input_cost = $2,
          total_output_value = $3,
          yield_percentage = $4,
          variance_classification = $5,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [run.id, totalInputCost, totalOutputValue, yieldPercentage, varianceClassification]
  );

  return { production_run: updated.rows[0], inputs: postedInputs, outputs: postedOutputs };
}

export async function closeOutletVariance(shiftId: string, actorId: string) {
  const rows = await db.query(
    `
      SELECT c.*, i.name AS outlet_item_name, s.branch_id
      FROM pos_shift_stock_counts c
      LEFT JOIN pos_outlet_items i ON i.id = c.outlet_item_id
      JOIN pos_outlet_shifts s ON s.id = c.shift_id
      WHERE c.shift_id = $1
    `,
    [shiftId]
  );

  const updatedRows: JsonRecord[] = [];
  for (const row of rows.rows) {
    const expected =
      numberValue(row.opening_stock)
      + numberValue(row.additions)
      + numberValue(row.received_stock)
      + numberValue(row.produced_stock)
      + numberValue(row.transferred_in)
      - numberValue(row.sold_quantity)
      - numberValue(row.issued_out_quantity)
      - numberValue(row.wastage_quantity);
    const actual = row.physical_count === null || row.physical_count === undefined
      ? expected
      : numberValue(row.physical_count);
    const variance = actual - expected;
    const varianceValue = variance * numberValue(row.cost_price);
    const classification = classifyVariance(variance, varianceValue);
    const status = outletStatusFor({ ...row, expected_closing_stock: expected, actual_closing_stock: actual, variance });

    const updated = await db.query(
      `
        UPDATE pos_shift_stock_counts
        SET expected_closing_stock = $2,
            actual_closing_stock = $3,
            system_closing_stock = $2,
            variance = $4,
            variance_value = $5,
            variance_classification = $6,
            variance_status = $7,
            closed_by = $8::uuid,
            closed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [row.id, expected, actual, variance, varianceValue, classification, status, actorId]
    );
    updatedRows.push(updated.rows[0]);

    if (classification === 'critical') {
      await db.query(
        `
          INSERT INTO stock_take_investigations (
            branch_id, item_sku, severity, reason, status, created_by, metadata
          )
          VALUES ($1, $2, 'critical', $3, 'open', $4::uuid, $5::jsonb)
        `,
        [
          row.branch_id,
          row.sku,
          `Critical POS shift variance for ${row.item_name || row.outlet_item_name || row.sku}`,
          actorId,
          JSON.stringify({ shift_id: shiftId, stock_count_id: row.id, variance, variance_value: varianceValue })
        ]
      );
    }
  }

  return updatedRows;
}

export async function listAdjustmentRequests(filters: {
  branchId?: number | null;
  status?: string | null;
  limit?: number;
}) {
  const params: any[] = [];
  const where: string[] = [];
  if (filters.branchId) {
    params.push(filters.branchId);
    where.push(`r.branch_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`r.status = $${params.length}`);
  }
  params.push(Math.min(Math.max(filters.limit || 100, 1), 300));

  try {
    const result = await db.query(
      `
        SELECT r.*,
               COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.item_name) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
        FROM inventory_adjustment_requests r
        LEFT JOIN inventory_adjustment_request_items i ON i.adjustment_request_id = r.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT $${params.length}
      `,
      params
    );
    return result.rows;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('inventory_adjustment_requests') && msg.includes('does not exist')) {
      return [];
    }
    throw err;
  }
}

export async function createAdjustmentRequest(input: JsonRecord, actorId: string) {
  const branchId = Number(input.branch_id ?? input.branchId);
  if (!Number.isFinite(branchId)) throw new AppError('Branch is required', 400);
  const reason = textValue(input.reason ?? input.notes);
  if (!reason) throw new AppError('Adjustment reason is required', 400);
  const adjustmentReason = textValue(input.adjustment_reason ?? input.adjustmentReason, 'correction');
  const items = Array.isArray(input.items) ? input.items : [input].filter(Boolean);
  if (!items.length) throw new AppError('At least one adjustment item is required', 400);

  const created = await db.query(
    `
      INSERT INTO inventory_adjustment_requests (
        adjustment_number, branch_id, location_type, outlet_id, adjustment_reason,
        status, reason, requested_by, metadata
      )
      VALUES ($1, $2, $3, $4::uuid, $5, 'requested', $6, $7::uuid, $8::jsonb)
      RETURNING *
    `,
    [
      input.adjustment_number ?? input.adjustmentNumber ?? documentNumber('ADJ'),
      branchId,
      input.location_type ?? input.locationType ?? 'branch_store',
      input.outlet_id ?? input.outletId ?? null,
      adjustmentReason,
      reason,
      actorId,
      JSON.stringify(input.metadata || {})
    ]
  );

  const request = created.rows[0];
  const insertedItems: JsonRecord[] = [];
  for (const itemInput of items) {
    const sku = textValue(itemInput.item_sku ?? itemInput.sku);
    const quantity = numberValue(itemInput.adjustment_quantity ?? itemInput.quantity);
    if (!sku || quantity === 0) throw new AppError('Adjustment item SKU and non-zero quantity are required', 400);
    const item = await getSimpleItem(sku);
    const current = await db.query('SELECT quantity FROM branch_stock WHERE branch_id = $1 AND item_sku = $2 LIMIT 1', [branchId, sku]);
    const systemQty = numberValue(itemInput.system_quantity ?? current.rows[0]?.quantity);
    const inserted = await db.query(
      `
        INSERT INTO inventory_adjustment_request_items (
          adjustment_request_id, item_sku, item_name, system_quantity,
          adjustment_quantity, final_quantity, unit, unit_cost, explanation, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        RETURNING *
      `,
      [
        request.id,
        sku,
        itemInput.item_name || item.item_name || sku,
        systemQty,
        quantity,
        systemQty + quantity,
        itemInput.unit || item.unit_of_measure || 'units',
        numberValue(itemInput.unit_cost ?? item.cost_price),
        itemInput.explanation ?? null,
        JSON.stringify(itemInput.metadata || {})
      ]
    );
    insertedItems.push(inserted.rows[0]);
  }

  return { adjustment_request: request, items: insertedItems };
}

export async function reviewAdjustmentRequest(requestId: string, input: JsonRecord, actorId: string) {
  const status = input.approved === true || input.status === 'approved'
    ? 'approved'
    : input.status === 'rejected'
      ? 'rejected'
      : 'reviewed';
  const result = await db.query(
    `
      UPDATE inventory_adjustment_requests
      SET status = $2,
          reviewed_by = $3::uuid,
          reviewed_at = NOW(),
          approved_by = CASE WHEN $2 = 'approved' THEN $3::uuid ELSE approved_by END,
          approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE approved_at END,
          rejection_reason = CASE WHEN $2 = 'rejected' THEN $4 ELSE rejection_reason END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [requestId, status, actorId, input.rejection_reason ?? input.notes ?? null]
  );
  if (!result.rows[0]) throw new AppError('Adjustment request not found', 404);
  return result.rows[0];
}

export async function postAdjustmentRequest(requestId: string, actorId: string) {
  const requestResult = await db.query('SELECT * FROM inventory_adjustment_requests WHERE id = $1', [requestId]);
  const request = requestResult.rows[0];
  if (!request) throw new AppError('Adjustment request not found', 404);
  if (!['approved', 'reviewed'].includes(String(request.status))) {
    throw new AppError('Adjustment must be reviewed/approved before posting', 409);
  }

  const items = await db.query('SELECT * FROM inventory_adjustment_request_items WHERE adjustment_request_id = $1', [requestId]);
  const postedItems: JsonRecord[] = [];
  for (const row of items.rows) {
    const simple = await getSimpleItem(row.item_sku);
    await seedFoundationBranchBalance(Number(request.branch_id), simple, actorId);
    const quantity = numberValue(row.adjustment_quantity);
    const sourceLocation = quantity < 0
      ? branchStoreLocation(Number(request.branch_id))
      : adjustmentLocation(Number(request.branch_id));
    const destinationLocation = quantity < 0
      ? adjustmentLocation(Number(request.branch_id))
      : branchStoreLocation(Number(request.branch_id));
    const movementType = quantity < 0 && ['damage', 'expiry', 'loss', 'theft', 'breakage', 'spoilage', 'write_off'].includes(String(request.adjustment_reason))
      ? 'write_off'
      : quantity < 0
        ? 'stock_take_adjustment'
        : 'purchase_receipt';

    const movement = await InventoryFoundationService.recordMovement({
      movementType: movementType as any,
      item: {
        sku: row.item_sku,
        itemName: row.item_name || simple.item_name || row.item_sku,
        category: simple.category,
        unit: row.unit || simple.unit_of_measure || 'units',
        defaultUnitCost: numberValue(row.unit_cost ?? simple.cost_price)
      },
      sourceLocation,
      destinationLocation,
      quantity: Math.abs(quantity),
      unitCost: numberValue(row.unit_cost ?? simple.cost_price),
      reason: request.reason,
      documentType: 'stock_adjustment',
      documentReference: request.id,
      documentNumber: request.adjustment_number,
      metadata: { adjustment_reason: request.adjustment_reason, adjustment_item_id: row.id }
    }, actorId);

    await BranchInventoryService.updateBranchStock(
      Number(request.branch_id),
      row.item_sku,
      quantity,
      'STOCK_ADJUSTMENT',
      actorId,
      'stock_adjustment',
      request.id,
      request.adjustment_number,
      request.reason
    );

    const updated = await db.query(
      `
        UPDATE inventory_adjustment_request_items
        SET movement_id = $2::uuid
        WHERE id = $1
        RETURNING *
      `,
      [row.id, movement.movement.id]
    );
    postedItems.push(updated.rows[0]);
  }

  const posted = await db.query(
    `
      UPDATE inventory_adjustment_requests
      SET status = 'posted',
          posted_by = $2::uuid,
          posted_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [requestId, actorId]
  );

  await supabase.from('inventory_documents').insert({
    document_type: 'stock_adjustment',
    document_number: request.adjustment_number,
    source_table: 'inventory_adjustment_requests',
    source_id: request.id,
    branch_id: request.branch_id,
    status: 'archived',
    generated_by: actorId,
    metadata: {
      item_count: postedItems.length,
      reason: request.adjustment_reason
    }
  }).then();

  return { adjustment_request: posted.rows[0], items: postedItems };
}
