/**
 * Multi-Branch Inventory Service
 * Handles stock requests, dispatch notes, and branch stock management
 */

import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import notificationService from './notification.service';
import { AppError } from '../middleware/errorHandler';
import * as InventoryFoundationService from './inventory-foundation.service';
import { recordBarStockMovement } from './unified-bar-stock.service';

const KYOGONG_CENTRAL_BRANCH_ID = 1;
const KYOGONG_BRANCH_CODE = 'KYO';

// ============================================================
// TYPES
// ============================================================

export interface StockRequestItem {
  item_sku: string;
  requested_quantity: number;
  current_branch_stock?: number;
}

export interface DispatchItem {
  item_sku: string;
  dispatched_quantity: number;
  batch_number?: string;
  expiry_date?: string;
  bin_location?: string;
}

interface DirectDispatchOptions {
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  estimatedDelivery?: string;
  notes?: string;
  vehicleId?: string;
  driverId?: string;
}

type MovementLocationInput = {
  branchId?: number;
  locationType: 'central_store' | 'branch_store' | 'transit';
  locationCode: string;
  locationName: string;
};

const branchStoreLocation = (branchId: number, label = 'Branch Store', central = false): MovementLocationInput => ({
  branchId,
  locationType: central ? 'central_store' : 'branch_store',
  locationCode: central ? `CENTRAL-${branchId}-STORE` : `BRANCH-${branchId}-STORE`,
  locationName: `${label} ${branchId}`
});

const transitLocation = (dispatchId: string, dispatchNumber: string, branchId?: number): MovementLocationInput => ({
  branchId,
  locationType: 'transit',
  locationCode: `TRANSIT-${dispatchId}`,
  locationName: `In transit ${dispatchNumber}`
});

type BranchStockSource = {
  available: number;
  source: 'inventory_balances' | 'branch_stock' | 'none';
  itemExists: boolean;
  balanceId?: string;
  branchStockExists: boolean;
};

type LiveBranchBalanceRow = {
  balanceId: string;
  itemId: string;
  sku: string;
  quantity: number;
  unitCost: number;
};

async function getBranchLocationContext(branchId: number): Promise<{
  isCentralStore: boolean;
  locationId?: string;
}> {
  const { data: branchRow, error: branchError } = await supabase
    .from('branches')
    .select('is_central_warehouse, is_main_branch')
    .eq('id', branchId)
    .maybeSingle();

  if (branchError) throw branchError;

  const isCentralStore =
    branchId === KYOGONG_CENTRAL_BRANCH_ID ||
    branchRow?.is_central_warehouse === true;
  const locationType = isCentralStore ? 'central_store' : 'branch_store';

  const { data: locRow, error: locError } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('branch_id', branchId)
    .eq('location_type', locationType)
    .limit(1)
    .maybeSingle();

  if (locError) throw locError;

  return {
    isCentralStore,
    locationId: locRow?.id,
  };
}

async function getLiveBranchBalancesBySku(branchId: number): Promise<Map<string, LiveBranchBalanceRow>> {
  const { locationId } = await getBranchLocationContext(branchId);
  if (!locationId) return new Map();

  const { data: balances, error: balancesError } = await supabase
    .from('inventory_balances')
    .select('id, item_id, current_quantity, unit_cost')
    .eq('location_id', locationId);

  if (balancesError) throw balancesError;
  if (!balances || balances.length === 0) return new Map();

  const itemIds = [...new Set(balances.map((row: any) => row.item_id).filter(Boolean))];
  if (itemIds.length === 0) return new Map();

  const { data: items, error: itemsError } = await supabase
    .from('inventory_items')
    .select('id, sku')
    .in('id', itemIds);

  if (itemsError) throw itemsError;

  const skuByItemId = new Map<string, string>(
    (items || [])
      .filter((item: any) => item?.id && item?.sku)
      .map((item: any) => [String(item.id), String(item.sku)])
  );

  const result = new Map<string, LiveBranchBalanceRow>();
  for (const balance of balances) {
    const sku = skuByItemId.get(String(balance.item_id));
    if (!sku) continue;

    const quantity = Number(balance.current_quantity ?? 0);
    const existing = result.get(sku);
    if (existing) {
      existing.quantity += quantity;
      continue;
    }

    result.set(sku, {
      balanceId: String(balance.id),
      itemId: String(balance.item_id),
      sku,
      quantity,
      unitCost: Number(balance.unit_cost ?? 0),
    });
  }

  return result;
}

async function resolveBranchStockSource(branchId: number, itemSku: string): Promise<BranchStockSource> {
  const [branchStockRes, itemRes, locationContext] = await Promise.all([
    supabase
      .from('branch_stock')
      .select('quantity')
      .eq('branch_id', branchId)
      .eq('item_sku', itemSku)
      .maybeSingle(),
    supabase
      .from('inventory_items')
      .select('id')
      .eq('sku', itemSku)
      .maybeSingle(),
    getBranchLocationContext(branchId)
  ]);

  if (branchStockRes.error) throw branchStockRes.error;
  if (itemRes.error) throw itemRes.error;

  const branchStockQuantity = Number(branchStockRes.data?.quantity ?? 0);
  const isCentralStore = locationContext.isCentralStore;

  let balanceId: string | undefined;
  let balanceQuantity = 0;
  if (itemRes.data?.id && locationContext.locationId) {
    const { data: balRow, error: balError } = await supabase
      .from('inventory_balances')
      .select('id, current_quantity')
      .eq('item_id', itemRes.data.id)
      .eq('location_id', locationContext.locationId)
      .is('batch_id', null)
      .limit(1)
      .maybeSingle();

    if (balError) throw balError;
    if (balRow) {
      balanceId = balRow.id;
      balanceQuantity = Number(balRow.current_quantity ?? 0);
    }
  }

  if (
    balanceId &&
    (
      isCentralStore ||
      !branchStockRes.data ||
      (branchStockQuantity <= 0 && balanceQuantity > 0)
    )
  ) {
    return {
      available: balanceQuantity,
      source: 'inventory_balances',
      itemExists: true,
      balanceId,
      branchStockExists: !!branchStockRes.data
    };
  }

  if (branchStockRes.data) {
    return {
      available: branchStockQuantity,
      source: 'branch_stock',
      itemExists: !!itemRes.data,
      branchStockExists: true
    };
  }

  // Final fallback for central store: read from simple_items master stock
  if (isCentralStore) {
    const { data: simpleItem } = await supabase
      .from('simple_items')
      .select('quantity')
      .eq('sku', itemSku)
      .maybeSingle();

    if (simpleItem !== null) {
      const simpleQty = Number(simpleItem?.quantity ?? 0);
      return {
        available: simpleQty,
        source: 'branch_stock', // treat as authoritative for dispatch validation
        itemExists: true,
        branchStockExists: false
      };
    }
  }

  return {
    available: 0,
    source: 'none',
    itemExists: !!itemRes.data,
    branchStockExists: false
  };
}

async function foundationBalance(branchId: number, sku: string, locationCode: string): Promise<number> {
  try {
    const rows = await InventoryFoundationService.listBalances({ branchId, search: sku, limit: 100 });
    const row = rows.find((balance: any) => String(balance.sku) === sku && String(balance.location_code) === locationCode);
    return Number(row?.current_quantity || 0);
  } catch (error) {
    logger.warn(`Inventory foundation balance lookup failed for ${sku}: ${(error as Error).message}`);
    return 0;
  }
}

async function seedFoundationBalanceIfNeeded(input: {
  branchId: number;
  sku: string;
  itemName?: string | null;
  location: any;
  requiredQuantity: number;
  knownLegacyQuantity?: number;
  actorId: string;
  documentReference: string;
}) {
  const current = await foundationBalance(input.branchId, input.sku, input.location.locationCode);
  if (current >= input.requiredQuantity) return;

  const seedQuantity = current > 0
    ? input.requiredQuantity - current
    : Math.max(input.requiredQuantity, Number(input.knownLegacyQuantity || 0));
  if (seedQuantity <= 0) return;

  await InventoryFoundationService.recordMovement({
    movementType: 'purchase_receipt',
    item: {
      sku: input.sku,
      sourceTable: 'simple_items',
      sourceItemKey: input.sku,
      itemName: input.itemName || input.sku
    },
    sourceLocation: {
      locationType: 'external',
      locationCode: 'LEGACY-STOCK-BASELINE',
      locationName: 'Legacy stock baseline'
    },
    destinationLocation: input.location,
    quantity: seedQuantity,
    reason: 'Legacy balance baseline before controlled stock movement',
    documentType: 'stock_take_adjustment',
    documentReference: input.documentReference,
    documentNumber: input.documentReference,
    metadata: {
      generated_by_controlled_movement_bridge: true,
      legacy_quantity: input.knownLegacyQuantity || null
    }
  }, input.actorId);
}

async function recordFoundationMovementBestEffort(input: {
  movementType: 'branch_requisition_dispatch' | 'transfer';
  sku: string;
  itemName?: string | null;
  quantity: number;
  sourceBranchId: number;
  destinationBranchId?: number;
  sourceLocation: any;
  destinationLocation: any;
  actorId: string;
  documentType: string;
  documentReference: string;
  reason: string;
  knownSourceLegacyQuantity?: number;
  metadata?: Record<string, any>;
}) {
  try {
    await seedFoundationBalanceIfNeeded({
      branchId: input.sourceBranchId,
      sku: input.sku,
      itemName: input.itemName,
      location: input.sourceLocation,
      requiredQuantity: input.quantity,
      knownLegacyQuantity: input.knownSourceLegacyQuantity,
      actorId: input.actorId,
      documentReference: input.documentReference
    });

    await InventoryFoundationService.recordMovement({
      movementType: input.movementType,
      item: {
        sku: input.sku,
        sourceTable: 'simple_items',
        sourceItemKey: input.sku,
        itemName: input.itemName || input.sku
      },
      sourceLocation: input.sourceLocation,
      destinationLocation: input.destinationLocation,
      quantity: input.quantity,
      reason: input.reason,
      documentType: input.documentType,
      documentReference: input.documentReference,
      documentNumber: input.documentReference,
      metadata: input.metadata || {}
    }, input.actorId);
  } catch (error) {
    logger.warn(`Inventory foundation movement bridge failed for ${input.sku}: ${(error as Error).message}`);
  }
}

// ============================================================
// BRANCH STOCK MANAGEMENT
// ============================================================

/**
 * Get stock for a specific branch
 */
export async function getBranchStock(branchId: number) {
  const [branchStockRes, liveBalances] = await Promise.all([
    supabase
      .from('branch_stock')
      .select('*')
      .eq('branch_id', branchId)
      .order('quantity', { ascending: true }),
    getLiveBranchBalancesBySku(branchId)
  ]);

  const { data: stock, error } = branchStockRes;
  if (error) throw error;

  const stockRows = [...(stock || [])];
  const stockBySku = new Map<string, any>(
    stockRows
      .filter((row: any) => row?.item_sku)
      .map((row: any) => [String(row.item_sku), row])
  );

  for (const [sku, liveRow] of liveBalances.entries()) {
    const legacyRow = stockBySku.get(sku);
    if (legacyRow) {
      if (Number(legacyRow.quantity ?? 0) <= 0 && liveRow.quantity > 0) {
        legacyRow.quantity = liveRow.quantity;
      }
      continue;
    }

    stockRows.push({
      branch_id: branchId,
      item_sku: sku,
      quantity: liveRow.quantity,
      reorder_level: 10,
      max_stock_level: 100,
    });
  }

  if (stockRows.length === 0) return [];

  const skus = [...new Set(stockRows.map((row: any) => row.item_sku).filter(Boolean))];

  const [simpleItemsRes, inventoryItemsRes, dispatchMovementsRes] = await Promise.all([
    supabase
      .from('simple_items')
      .select('sku, item_name, description, category, unit_of_measure, retail_price, cost_price, store_type')
      .in('sku', skus),
    supabase
      .from('inventory_items')
      .select('sku, item_name, description, category, unit, default_unit_cost, store_type, reorder_level')
      .in('sku', skus),
    supabase
      .from('branch_stock_movements')
      .select('item_sku')
      .eq('branch_id', branchId)
      .in('movement_type', ['DISPATCH_RECEIVE', 'RECEIVE_FROM_SUPPLIER', 'SUPPLIER_RECEIPT'])
      .in('item_sku', skus)
  ]);

  if (simpleItemsRes.error) throw simpleItemsRes.error;
  if (inventoryItemsRes.error) throw inventoryItemsRes.error;
  if (dispatchMovementsRes.error) throw dispatchMovementsRes.error;

  const simpleItemBySku = new Map((simpleItemsRes.data || []).map((item: any) => [item.sku, item]));
  const inventoryItemBySku = new Map((inventoryItemsRes.data || []).map((item: any) => [item.sku, item]));
  const dispatchedSkus = new Set((dispatchMovementsRes.data || []).map((movement: any) => movement.item_sku));

  return stockRows.map((row: any) => {
    const simpleItem = simpleItemBySku.get(row.item_sku);
    const inventoryItem = inventoryItemBySku.get(row.item_sku);
    const liveRow = liveBalances.get(String(row.item_sku));
    const quantity = Number(row.quantity ?? 0);

    return {
      ...row,
      quantity,
      reorder_level: Number(row.reorder_level ?? inventoryItem?.reorder_level ?? 10),
      item: simpleItem,
      item_name:
        simpleItem?.item_name ||
        inventoryItem?.item_name ||
        simpleItem?.description ||
        inventoryItem?.description ||
        row.item_sku,
      description:
        simpleItem?.description ||
        inventoryItem?.description ||
        simpleItem?.item_name ||
        inventoryItem?.item_name ||
        row.item_sku,
      category: simpleItem?.category || inventoryItem?.category || null,
      unit_of_measure: simpleItem?.unit_of_measure || inventoryItem?.unit,
      cost_price:
        Number(row.cost_price ?? 0) ||
        liveRow?.unitCost ||
        Number(simpleItem?.cost_price ?? 0) ||
        Number(inventoryItem?.default_unit_cost ?? 0),
      store_type:
        simpleItem?.store_type ||
        inventoryItem?.store_type ||
        row.store_type ||
        'foodstuffs',
      source: dispatchedSkus.has(row.item_sku)
        ? 'dispatch'
        : liveRow && quantity > 0
          ? 'inventory_balances'
          : 'catalog'
    };
  });
}

/**
 * Get low stock items for a branch
 */
export async function getLowStockItems(branchId: number) {
  const stock = await getBranchStock(branchId);
  return stock
    .filter((item: any) => Number(item.quantity ?? 0) <= Number(item.reorder_level ?? 10))
    .sort((left: any, right: any) => Number(left.quantity ?? 0) - Number(right.quantity ?? 0));
}

/**
 * Initialize branch stock for a new item (when central creates item)
 */
export async function initializeBranchStock(itemSku: string, branches: number[]) {
  const stockRecords = branches.map(branchId => ({
    branch_id: branchId,
    item_sku: itemSku,
    quantity: 0,
    reorder_level: 10,
    max_stock_level: 100
  }));

  const { error } = await supabase
    .from('branch_stock')
    .upsert(stockRecords, { onConflict: 'branch_id,item_sku' });

  if (error) throw error;
}

/**
 * Update branch stock quantity
 */
export async function updateBranchStock(
  branchId: number,
  itemSku: string,
  quantityChange: number,
  movementType: string,
  userId: string,
  referenceType?: string,
  referenceId?: string,
  referenceNumber?: string,
  notes?: string,
  reorderLevel?: number,
  maxStockLevel?: number
) {
  const stockSource = await resolveBranchStockSource(branchId, itemSku);
  const previousStock = stockSource.available;
  let inventoryBalanceId = stockSource.source === 'inventory_balances' ? stockSource.balanceId : null;

  const newStock = previousStock + quantityChange;

  if (quantityChange < 0 && newStock < 0) {
    throw new AppError(
      `Insufficient branch stock for ${itemSku}. Available ${previousStock}, requested ${Math.abs(quantityChange)}`,
      409
    );
  }

  const [inventoryItemRes, locationContext, existingBranchStockRes] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id')
      .eq('sku', itemSku)
      .maybeSingle(),
    getBranchLocationContext(branchId),
    supabase
      .from('branch_stock')
      .select('reorder_level, max_stock_level')
      .eq('branch_id', branchId)
      .eq('item_sku', itemSku)
      .maybeSingle()
  ]);

  if (inventoryItemRes.error) throw inventoryItemRes.error;
  if (existingBranchStockRes.error) throw existingBranchStockRes.error;

  if (!inventoryBalanceId && inventoryItemRes.data?.id && locationContext.locationId) {
    const { data: existingBalance, error: existingBalanceError } = await supabase
      .from('inventory_balances')
      .select('id')
      .eq('item_id', inventoryItemRes.data.id)
      .eq('location_id', locationContext.locationId)
      .is('batch_id', null)
      .maybeSingle();

    if (existingBalanceError) throw existingBalanceError;
    if (existingBalance?.id) {
      inventoryBalanceId = existingBalance.id;
    } else {
      const { data: createdBalance, error: createBalanceError } = await supabase
        .from('inventory_balances')
        .insert({
          item_id: inventoryItemRes.data.id,
          location_id: locationContext.locationId,
          batch_id: null,
          current_quantity: Math.max(0, newStock),
          reserved_quantity: 0,
          damaged_quantity: 0,
          expired_quantity: 0,
          unit_cost: 0,
        })
        .select('id')
        .maybeSingle();

      if (createBalanceError) throw createBalanceError;
      inventoryBalanceId = createdBalance?.id;
    }
  }

  if (inventoryBalanceId) {
    const { error: balUpdateError } = await supabase
      .from('inventory_balances')
      .update({ current_quantity: Math.max(0, newStock), updated_at: new Date().toISOString() })
      .eq('id', inventoryBalanceId);
    if (balUpdateError) throw balUpdateError;
  }

  const existingBranchStock = existingBranchStockRes.data || null;
  const nextReorderLevel = reorderLevel !== undefined
    ? reorderLevel
    : Number(existingBranchStock?.reorder_level ?? 10);
  const nextMaxStockLevel = maxStockLevel !== undefined
    ? maxStockLevel
    : Number(existingBranchStock?.max_stock_level ?? 100);

  const { error: updateError } = await supabase
    .from('branch_stock')
    .upsert({
      branch_id: branchId,
      item_sku: itemSku,
      quantity: Math.max(0, newStock),
      reorder_level: nextReorderLevel,
      max_stock_level: nextMaxStockLevel,
      last_stock_in: quantityChange > 0 ? new Date().toISOString() : undefined,
      last_stock_out: quantityChange < 0 ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString()
    }, { onConflict: 'branch_id,item_sku' });
  if (updateError) throw updateError;

  // Log movement
  const { error } = await supabase.from('branch_stock_movements').insert({
    branch_id: branchId,
    item_sku: itemSku,
    movement_type: movementType,
    quantity: Math.abs(quantityChange),
    previous_stock: previousStock,
    new_stock: newStock,
    reference_type: referenceType,
    reference_id: referenceId,
    reference_number: referenceNumber,
    notes,
    performed_by: userId
  });

  if (error) {

    console.error('Database error:', error);

    throw error;

  }

  // Notify Auditor for specific movement types
  if (movementType === 'STOCK_OUT') {
    try {
      // Get item and branch names for the notification
      const [itemRes, branchRes] = await Promise.all([
        supabase.from('simple_items').select('item_name').eq('sku', itemSku).maybeSingle(),
        supabase.from('branches').select('name').eq('id', branchId).maybeSingle()
      ]);

      const itemName = itemRes.data?.item_name || itemSku;
      const branchName = branchRes.data?.name || `Branch #${branchId}`;

      await notificationService.notifyRole(
        'auditor',
        'Stock Issued (Stock Out)',
        `${branchName} has issued ${Math.abs(quantityChange)} units of ${itemName}. Reason: ${notes || 'Not specified'}`,
        {
          type: 'warning',
          category: 'stock',
          priority: 'medium',
          branchId: branchId,
          actionUrl: `/dashboard/branch-store/stock-out?branch_id=${branchId}`,
          metadata: {
            branch_id: branchId,
            item_sku: itemSku,
            quantity: Math.abs(quantityChange),
            reason: notes
          }
        }
      );
    } catch (notifyError) {
      logger.error('Failed to notify auditor of stock out', notifyError);
    }
  }

  return { previousStock, newStock };
}

/**
 * Credit produced/issued quantity onto a pos_outlet_items row, honoring
 * stock-pool sharing (e.g. Half/Quarter Chicken sharing the Full Chicken
 * pool) and the unified bar-stock ledger sync for bar-sourced items.
 * Shared by Kitchen Shift production and Outlet Production posting so both
 * paths credit POS stock identically instead of each reimplementing it.
 */
export async function creditOutletItemStock(outletItemId: string, qty: number): Promise<void> {
  const { data: oi } = await supabase
    .from('pos_outlet_items')
    .select('current_stock,stock_pool_item_id,pool_fraction,outlet_id,source_table,source_item_id,sku')
    .eq('id', outletItemId)
    .single();
  if (!oi) return;

  if (oi.source_table === 'bar_drinks' && oi.source_item_id && oi.outlet_id) {
    try {
      const { data: outlet } = await supabase
        .from('pos_outlets')
        .select('branch_id, outlet_type')
        .eq('id', oi.outlet_id)
        .maybeSingle();
      if (
        outlet?.branch_id &&
        ['main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar'].includes(outlet.outlet_type)
      ) {
        await recordBarStockMovement({
          branchId: outlet.branch_id,
          outletId: oi.outlet_id,
          drinkId: oi.source_item_id,
          sku: oi.sku || undefined,
          quantityDelta: qty,
          movementType: 'production',
          notes: 'Kitchen production added to bar POS'
        });
      }
    } catch (syncErr: any) {
      logger.warn('Unified bar stock sync failed for kitchen production (non-critical):', syncErr.message);
    }
  }

  if (oi.stock_pool_item_id) {
    const { data: pool } = await supabase
      .from('pos_outlet_items')
      .select('current_stock')
      .eq('id', oi.stock_pool_item_id)
      .single();
    if (pool) {
      await supabase
        .from('pos_outlet_items')
        .update({
          current_stock: Number(pool.current_stock || 0) + qty * Number(oi.pool_fraction || 1),
          updated_at: new Date().toISOString()
        })
        .eq('id', oi.stock_pool_item_id);
    }
    return;
  }

  await supabase
    .from('pos_outlet_items')
    .update({
      current_stock: Number(oi.current_stock || 0) + qty,
      updated_at: new Date().toISOString()
    })
    .eq('id', outletItemId);
}

/**
 * Automatically records kitchen raw material consumption from a POS shift order when it is paid.
 */
export async function recordKitchenConsumption(
  orderId: string,
  orderItems: any[],
  branchId: number,
  posShiftId?: string
): Promise<void> {
  try {
    // 1. Find the active open kitchen shift for this branch
    const { data: shift, error: shiftError } = await supabase
      .from('kitchen_shifts')
      .select('id, shift_number')
      .eq('branch_id', branchId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (shiftError) {
      logger.error('Error finding active kitchen shift for consumption:', shiftError);
      return;
    }

    if (!shift) {
      // No active kitchen shift running at this branch
      return;
    }

    for (const item of orderItems) {
      if (!item.outlet_item_id) continue;

      // 2. Lookup recipe for this pos_outlet_item
      const { data: recipe, error: recipeError } = await supabase
        .from('kitchen_production_recipes')
        .select('*')
        .eq('pos_outlet_item_id', item.outlet_item_id)
        .eq('is_active', true)
        .maybeSingle();

      if (recipeError) {
        logger.error(`Error looking up recipe for item ${item.outlet_item_id}:`, recipeError);
        continue;
      }

      if (!recipe) {
        // No recipe means this item doesn't require raw material consumption tracking
        continue;
      }

      const portionsSold = Number(item.quantity || item.qty || 0);
      if (portionsSold <= 0) continue;

      // Calculate raw material consumed
      const ratio = Number(recipe.conversion_ratio || 0);
      const rawQtyConsumed = ratio > 0 ? portionsSold / ratio : 0;

      if (rawQtyConsumed <= 0) continue;

      // 3. Log the consumption
      const { error: consError } = await supabase
        .from('kitchen_shift_pos_consumption')
        .insert({
          shift_id: shift.id,
          branch_id: branchId,
          pos_shift_id: posShiftId || null,
          pos_order_id: orderId,
          pos_outlet_item_id: item.outlet_item_id,
          portions_sold: portionsSold,
          produced_item_sku: recipe.produced_item_sku,
          produced_item_name: recipe.produced_item_name,
          raw_item_sku: recipe.raw_item_sku,
          raw_item_name: recipe.raw_item_name,
          raw_quantity_consumed: rawQtyConsumed,
          raw_unit: recipe.raw_unit,
          cost_price: Number(recipe.cost_per_output || 0)
        });

      if (consError) {
        logger.error('Failed to insert kitchen shift pos consumption:', consError);
        continue;
      }

      // 4. Update sold_quantity in kitchen_shift_items
      const { data: shiftItem, error: itemError } = await supabase
        .from('kitchen_shift_items')
        .select('id, sold_quantity')
        .eq('shift_id', shift.id)
        .eq('item_sku', recipe.raw_item_sku)
        .maybeSingle();

      if (itemError) {
        logger.error(`Failed to lookup shift item for SKU ${recipe.raw_item_sku}:`, itemError);
        continue;
      }

      if (shiftItem) {
        const { error: updError } = await supabase
          .from('kitchen_shift_items')
          .update({
            sold_quantity: Number(shiftItem.sold_quantity || 0) + rawQtyConsumed,
            updated_at: new Date().toISOString()
          })
          .eq('id', shiftItem.id);

        if (updError) {
          logger.error(`Failed to update sold_quantity for shift item ${shiftItem.id}:`, updError);
        }
      }
    }
  } catch (error) {
    logger.error('Error recording kitchen consumption:', error);
  }
}

// ============================================================
// STOCK REQUESTS
// ============================================================

/**
 * Generate stock request number
 */
export async function generateStockRequestNumber(branchCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_stock_request_number', {
    p_branch_code: branchCode
  });

  if (error) {
    // Fallback: generate manually
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `FGH-SR-${branchCode.toUpperCase()}-${date}-${random}`;
  }

  return data;
}

/**
 * Create a new stock request
 */
export async function createStockRequest(
  branchId: number,
  branchCode: string,
  userId: string,
  items: StockRequestItem[],
  requestType: string = 'ROUTINE',
  priority: string = 'NORMAL',
  reason?: string,
  neededByDate?: string
) {
  // Generate request number
  const requestNumber = await generateStockRequestNumber(branchCode);

  // Create request
  const { data: request, error: requestError } = await supabase
    .from('stock_requests')
    .insert({
      request_number: requestNumber,
      requesting_branch_id: branchId,
      requested_by: userId,
      request_type: requestType,
      priority,
      reason,
      needed_by_date: neededByDate,
      status: 'PENDING_BRANCH_ACCOUNTANT_APPROVAL',
      workflow_status: 'submitted_to_branch_accountant',
      submitted_to_auditor_at: new Date().toISOString(),
      document_number: requestNumber,
      barcode_value: requestNumber
    })
    .select();

  if (requestError) throw requestError;

  if (!request || request.length === 0) {
    throw new Error('Failed to create stock request');
  }

  const createdRequest = request[0];

  // Add items
  const requestItems = items.map(item => ({
    request_id: createdRequest.id,
    item_sku: item.item_sku,
    requested_quantity: item.requested_quantity,
    current_branch_stock: item.current_branch_stock || 0,
    status: 'PENDING_BRANCH_ACCOUNTANT_APPROVAL',
    workflow_status: 'submitted_to_branch_accountant'
  }));

  const { error: itemsError } = await supabase
    .from('stock_request_items')
    .insert(requestItems);

  if (itemsError) throw itemsError;

  logger.info(`Stock request created: ${requestNumber} by branch ${branchCode}`);

  // Notify Auditor
  try {
    // Fetch branch name for notification
    const { data: branchData } = await supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .maybeSingle();

    const branchName = branchData?.name || branchCode;

    await notificationService.notifyRole(
      'branch_accountant',
      'New Stock Request for Review',
      `${branchName} branch has submitted a new stock request (${requestNumber}). Approval required.`,
      {
        type: 'info',
        category: 'stock',
        priority: priority === 'URGENT' ? 'urgent' : 'medium',
        branchId: branchId,
        actionUrl: '/dashboard/branch-accounting/stock-requests',
        metadata: {
          request_id: createdRequest.id,
          branch_code: branchCode,
          branch_name: branchName
        }
      }
    );
  } catch (error) {
    logger.error('Failed to send stock request notification', error);
  }

  return { ...createdRequest, items: requestItems };
}

/**
 * Get stock requests for a branch (or all branches if branchId is null)
 */
export async function getRequests(branchId: number | null, status?: string) {
  let query = supabase
    .from('stock_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (branchId) {
    query = query.eq('requesting_branch_id', branchId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data: requests, error } = await query;
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  // Get request items
  const requestIds = requests.map(r => r.id);
  const { data: items } = await supabase
    .from('stock_request_items')
    .select('*')
    .in('request_id', requestIds);

  // Get item details
  const skus = [...new Set((items || []).map(i => i.item_sku))];
  const { data: itemDetails } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, category, unit_of_measure')
    .in('sku', skus);

  // Get reviewer details (if any)
  const reviewerIds = [...new Set(requests.map(r => r.reviewed_by).filter(id => id))];
  let reviewers: any[] = [];
  if (reviewerIds.length > 0) {
    const { data: r } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', reviewerIds);
    reviewers = r || [];
  }

  // Get dispatch notes linked to these requests (to show distributed quantities)
  const { data: dispatches } = await supabase
    .from('dispatch_notes')
    .select('id, stock_request_id, status, dispatch_number, dispatched_at')
    .in('stock_request_id', requestIds);

  let dispatchItems: any[] = [];
  if (dispatches && dispatches.length > 0) {
    const dispatchIds = dispatches.map(d => d.id);
    const { data: dItems } = await supabase
      .from('dispatch_items')
      .select('dispatch_id, item_sku, dispatched_quantity, status')
      .in('dispatch_id', dispatchIds);
    dispatchItems = dItems || [];
  }

  // Map items and reviewers back to requests
  return requests.map(request => {
    // Find dispatch(es) for this request
    const requestDispatches = (dispatches || []).filter(d => d.stock_request_id === request.id);
    const requestDispatchIds = requestDispatches.map(d => d.id);
    const requestDispatchItems = dispatchItems.filter(di => requestDispatchIds.includes(di.dispatch_id));

    // Latest dispatch info
    const latestDispatch = requestDispatches[0] || null;

    return {
      ...request,
      branch: request.requesting_branch || { name: 'Unknown' },
      branch_name: request.requesting_branch?.name || 'Unknown',
      dispatch_number: latestDispatch?.dispatch_number || null,
      dispatch_status: latestDispatch?.status || null,
      dispatched_at: latestDispatch?.dispatched_at || null,
      items: (items || []).filter(i => i.request_id === request.id).map(i => {
        const details = itemDetails?.find(id => id.sku === i.item_sku);
        // Sum dispatched quantity across all dispatches for this item
        const dispatched_quantity = requestDispatchItems
          .filter(di => di.item_sku === i.item_sku)
          .reduce((sum: number, di: any) => sum + (di.dispatched_quantity || 0), 0);
        return {
          ...i,
          item: details,
          item_name: details?.item_name || i.item_sku,
          unit: details?.unit_of_measure || '',
          dispatched_quantity: dispatched_quantity || null
        };
      }),
      reviewed_by_user: reviewers.find(r => r.id === request.reviewed_by)
    };
  });
}

/**
 * Get stock requests for central review
 */
export async function getPendingRequests() {
  // Get requests
  const { data: requests, error } = await supabase
    .from('stock_requests')
    .select('*')
    .in('status', ['PENDING', 'PENDING_AUDIT', 'UNDER_REVIEW', 'PENDING_BRANCH_ACCOUNTANT_APPROVAL'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  // Get branches for these requests
  const branchIds = [...new Set(requests.map(r => r.requesting_branch_id))];
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, code, location')
    .in('id', branchIds);

  // Get items for these requests
  const requestIds = requests.map(r => r.id);
  const { data: items } = await supabase
    .from('stock_request_items')
    .select('*')
    .in('request_id', requestIds);

  // Get item details
  const itemSkus = [...new Set((items || []).map(i => i.item_sku))];
  const { data: itemDetails } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, category, unit_of_measure')
    .in('sku', itemSkus);

  // Combine data
  return requests.map(request => ({
    ...request,
    branch: branches?.find(b => b.id === request.requesting_branch_id) || { id: request.requesting_branch_id, name: 'Unknown', code: 'UNK', location: '' },
    branch_name: branches?.find(b => b.id === request.requesting_branch_id)?.name || 'Unknown',
    items: (items || [])
      .filter(i => i.request_id === request.id)
      .map(item => {
        const details = itemDetails?.find(d => d.sku === item.item_sku);
        return {
          ...item,
          item: details,
          item_name: details?.item_name || item.item_sku,
          unit: details?.unit_of_measure || ''
        };
      })
  }));
}

/**
 * Approve stock request (by central, auditor, or branch accountant).
 */
export async function approveStockRequest(
  requestId: string,
  reviewerId: string,
  approvedItems: { id: string; approved_quantity: number; status: string; rejection_reason?: string }[],
  reviewNotes?: string,
  options?: {
    workflowStatus?: string;
    itemWorkflowStatus?: string;
    reviewerRole?: string;
  }
) {
  const reviewerRole = options?.reviewerRole || 'Auditor';

  // Update request
  const allApproved = approvedItems.every(i => i.status === 'APPROVED');
  const allRejected = approvedItems.every(i => i.status === 'REJECTED');

  const newStatus = allRejected ? 'REJECTED' : allApproved ? 'APPROVED' : 'PARTIALLY_APPROVED';
  const workflowStatus = options?.workflowStatus
    || (allRejected ? 'auditor_rejected' : 'auditor_approved');
  const itemWorkflowStatus = options?.itemWorkflowStatus
    || (allRejected ? 'auditor_rejected' : 'auditor_approved');

  const isBranchAccountant = reviewerRole === 'Branch Accountant';

  const { error: requestError } = await supabase
    .from('stock_requests')
    .update({
      status: newStatus,
      workflow_status: workflowStatus,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      auditor_decision_at: isBranchAccountant ? null : new Date().toISOString(),
      sent_to_central_store_at: allRejected ? null : new Date().toISOString(),
      review_notes: reviewNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (requestError) throw requestError;

  // Update items
  for (const item of approvedItems) {
    await supabase
      .from('stock_request_items')
      .update({
        approved_quantity: item.approved_quantity,
        status: item.status,
        workflow_status: item.status === 'REJECTED' ? itemWorkflowStatus : itemWorkflowStatus,
        unavailable_quantity: item.status === 'REJECTED' ? item.approved_quantity || 0 : 0,
        rejection_reason: item.rejection_reason
      })
      .eq('id', item.id);
  }

  logger.info(`Stock request ${requestId} reviewed: ${newStatus}`);

  // Notify Central Ops Manager if Approved
  if (newStatus === 'APPROVED') {
    try {
      // Fetch request details for notification
      const { data: requestDetails } = await supabase
        .from('stock_requests')
        .select('request_number, requesting_branch_id')
        .eq('id', requestId)
        .maybeSingle();

      if (requestDetails) {
        // Notify Central Storekeeper to start packing
        await notificationService.notifyRole(
          'central_storekeeper',
          'Stock Request Approved',
          `Stock Request ${requestDetails.request_number} has been approved. Please proceed to packing.`,
          {
            type: 'info',
            category: 'stock',
            priority: 'high',
            actionUrl: '/dashboard/central-store/packing',
            metadata: { request_id: requestId, branch_id: requestDetails.requesting_branch_id }
          }
        );

        // Also notify general manager as per current flow
        await notificationService.notifyRole(
          'general_manager',
          'Stock Request Approved',
          `Stock Request ${requestDetails.request_number} approved by ${reviewerRole}. Ready for fulfillment.`,
          {
            type: 'info',
            category: 'stock',
            priority: 'high',
            actionUrl: '/dashboard/central-store/dispatch',
            metadata: { request_id: requestId, branch_id: requestDetails.requesting_branch_id }
          }
        );

        // Also notify branch storekeepers in the requesting branch (not branch accountants)
        await notificationService.notifyRole(
          'BRANCH_STOREKEEPER',
          `Stock Request ${newStatus}`,
          `Your stock request ${requestDetails.request_number} has been ${newStatus.toLowerCase()} by the ${reviewerRole}.`,
          {
            type: 'success',
            category: 'stock',
            priority: 'high',
            actionUrl: '/dashboard/branch-store/request-history',
            metadata: { request_id: requestId, status: newStatus },
            branchId: requestDetails.requesting_branch_id
          }
        );
      }
    } catch (e) {
      logger.error('Failed to notify central ops of stock request approval', e);
    }
  }

  return { status: newStatus };
}

// ============================================================
// DISPATCH NOTES
// ============================================================

/**
 * Generate dispatch note number
 */
export async function generateDispatchNumber(branchCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_dispatch_number', {
    p_branch_code: branchCode
  });

  if (error) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `FGH-DN-${branchCode.toUpperCase()}-${date}-${random}`;
  }

  return data;
}

/**
 * Create dispatch note from approved request
 */
export async function createDispatchFromRequest(
  requestId: string,
  fromBranchId: number,
  toBranchId: number,
  toBranchCode: string,
  userId: string,
  items: DispatchItem[],
  vehicleNumber?: string,
  driverName?: string,
  driverPhone?: string,
  estimatedDelivery?: string,
  notes?: string
) {
  // Generate dispatch number
  const dispatchNumber = await generateDispatchNumber(toBranchCode);

  // Create dispatch note
  const { data: dispatch, error: dispatchError } = await supabase
    .from('dispatch_notes')
    .insert({
      dispatch_number: dispatchNumber,
      stock_request_id: requestId,
      from_branch_id: fromBranchId,
      to_branch_id: toBranchId,
      created_by: userId,
      status: 'READY', // Changed from PENDING to READY as per user workflow
      workflow_status: 'packing',
      packing_started_at: new Date().toISOString(),
      packed_at: new Date().toISOString(), // Set packed_at since it is created as READY
      dispatch_document_number: dispatchNumber,
      barcode_value: dispatchNumber,
      vehicle_number: vehicleNumber,
      driver_name: driverName,
      driver_phone: driverPhone,
      estimated_delivery: estimatedDelivery,
      dispatch_notes: notes
    })
    .select();

  if (dispatchError) throw dispatchError;

  if (!dispatch || dispatch.length === 0) {
    throw new Error('Failed to create dispatch note');
  }

  const createdDispatch = dispatch[0];

  // Add items
  const dispatchItems = items.map(item => ({
    dispatch_id: createdDispatch.id,
    item_sku: item.item_sku,
    dispatched_quantity: item.dispatched_quantity,
    approved_quantity: item.dispatched_quantity,
    picked_quantity: item.dispatched_quantity,
    packed_quantity: item.dispatched_quantity,
    unavailable_quantity: 0,
    batch_number: item.batch_number,
    expiry_date: item.expiry_date,
    bin_location: item.bin_location,
    status: 'PENDING'
  }));

  const { error: itemsError } = await supabase
    .from('dispatch_items')
    .insert(dispatchItems);

  if (itemsError) throw itemsError;

  // Update request status
  await supabase
    .from('stock_requests')
    .update({
      status: 'DISPATCHED',
      workflow_status: 'packing',
      sent_to_central_store_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

  logger.info(`Dispatch note created: ${dispatchNumber} for request ${requestId}`);

  return { ...createdDispatch, items: dispatchItems };
}

/**
 * Create an ad-hoc dispatch note that is not tied to a stock request.
 */
export async function createDirectDispatch(
  fromBranchId: number,
  toBranchId: number,
  toBranchCode: string,
  userId: string,
  items: DispatchItem[],
  options?: DirectDispatchOptions
): Promise<Record<string, unknown>> {
  const dispatchNumber = await generateDispatchNumber(toBranchCode);
  const dispatchPayload: Record<string, unknown> = {
    dispatch_number: dispatchNumber,
    stock_request_id: null,
    from_branch_id: fromBranchId,
    to_branch_id: toBranchId,
    created_by: userId,
    status: 'READY',
    workflow_status: 'packing',
    packing_started_at: new Date().toISOString(),
    packed_at: new Date().toISOString(),
    dispatch_document_number: dispatchNumber,
    barcode_value: dispatchNumber,
    vehicle_number: options?.vehicleNumber,
    driver_name: options?.driverName,
    driver_phone: options?.driverPhone,
    estimated_delivery: options?.estimatedDelivery,
    dispatch_notes: options?.notes
  };

  if (options?.vehicleId) dispatchPayload.vehicle_id = options.vehicleId;
  if (options?.driverId) dispatchPayload.driver_id = options.driverId;

  const { data: dispatch, error: dispatchError } = await supabase
    .from('dispatch_notes')
    .insert(dispatchPayload)
    .select();

  if (dispatchError) throw dispatchError;

  if (!dispatch || dispatch.length === 0) {
    throw new Error('Failed to create dispatch note');
  }

  const createdDispatch = dispatch[0];

  const dispatchItems = items.map(item => ({
    dispatch_id: createdDispatch.id,
    item_sku: item.item_sku,
    dispatched_quantity: item.dispatched_quantity,
    approved_quantity: item.dispatched_quantity,
    picked_quantity: item.dispatched_quantity,
    packed_quantity: item.dispatched_quantity,
    unavailable_quantity: 0,
    batch_number: item.batch_number,
    expiry_date: item.expiry_date,
    bin_location: item.bin_location,
    status: 'PENDING'
  }));

  const { error: itemsError } = await supabase
    .from('dispatch_items')
    .insert(dispatchItems);

  if (itemsError) throw itemsError;

  logger.info(`Direct dispatch note created: ${dispatchNumber} for branch ${toBranchId}`);

  return { ...createdDispatch, items: dispatchItems };
}

/**
 * Dispatch items (deduct from central, move to in-transit)
 */
export async function dispatchItems(
  dispatchId: string,
  dispatcherId: string,
  updates?: {
    vehicle_number?: string;
    driver_name?: string;
    driver_phone?: string;
    estimated_delivery?: string;
    notes?: string;
  }
) {
  try {
    // Validate dispatch ID
    if (!dispatchId) {
      throw new Error('Dispatch ID is required');
    }

    // Get dispatch details
    const { data: dispatch, error: fetchError } = await supabase
      .from('dispatch_notes')
      .select('*')
      .eq('id', dispatchId)
      .maybeSingle();

    if (fetchError) {
      logger.error(`Error fetching dispatch ${dispatchId}:`, fetchError);
      throw new Error(`Dispatch not found or couldn't be accessed: ${fetchError.message}`);
    }

    if (!dispatch) {
      throw new Error('Dispatch note not found');
    }

    // Fetch dispatch items separately
    const { data: items, error: itemsError } = await supabase
      .from('dispatch_items')
      .select('*')
      .eq('dispatch_id', dispatchId);

    if (itemsError) {
      logger.error(`Error fetching dispatch items for ${dispatchId}:`, itemsError);
      throw new Error(`Failed to fetch dispatch items: ${itemsError.message}`);
    }

    // Attach items to dispatch
    dispatch.items = items || [];

    // Check if dispatch has already been processed
    if (dispatch.status !== 'READY') {
      throw new Error(`Dispatch is already ${dispatch.status.toLowerCase()}`);
    }

    // Check if dispatch has items
    if (!dispatch.items || dispatch.items.length === 0) {
      throw new Error('No items found in dispatch note');
    }

    // Pre-flight stock validation — collect ALL failures before throwing
    const stockErrors: string[] = [];

    for (const item of dispatch.items) {
      let stockSource: BranchStockSource;
      try {
        stockSource = await resolveBranchStockSource(dispatch.from_branch_id, item.item_sku);
      } catch (error: any) {
        stockErrors.push(`[${item.item_sku}] Failed to verify stock: ${error.message}`);
        continue;
      }

      if (!stockSource.itemExists && !stockSource.branchStockExists) {
        stockErrors.push(
          `[${item.item_sku}] Item is not in the master catalog. ` +
          `Add it to master inventory before dispatching.`
        );
        continue;
      }

      if (stockSource.available < item.dispatched_quantity) {
        stockErrors.push(
          `[${item.item_sku}] Insufficient stock. ` +
          `Available: ${stockSource.available}, Required: ${item.dispatched_quantity}.`
        );
      }
    }

    if (stockErrors.length > 0) {
      throw new Error(
        `INSUFFICIENT_STOCK: Cannot dispatch — the following items have stock issues in the central warehouse:\n` +
        stockErrors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')
      );
    }

    // Deduct from central warehouse stock
    for (const item of dispatch.items) {
      try {
        await updateBranchStock(
          dispatch.from_branch_id,
          item.item_sku,
          -item.dispatched_quantity,
          'DISPATCH_OUT',
          dispatcherId,
          'DISPATCH',
          dispatchId,
          dispatch.dispatch_number
        );

        // Also deduct from simple_items.quantity (the central store master stock display)
        const { data: simpleItem } = await supabase
          .from('simple_items')
          .select('quantity, item_name, description')
          .eq('sku', item.item_sku)
          .maybeSingle();
        if (simpleItem !== null) {
          const currentQty = simpleItem?.quantity ?? 0;
          await supabase
            .from('simple_items')
            .update({
              quantity: Math.max(0, currentQty - item.dispatched_quantity),
              updated_at: new Date().toISOString()
            })
            .eq('sku', item.item_sku);
        }

        await recordFoundationMovementBestEffort({
          movementType: 'branch_requisition_dispatch',
          sku: item.item_sku,
          itemName: simpleItem?.item_name || simpleItem?.description || item.item_sku,
          quantity: item.dispatched_quantity,
          sourceBranchId: dispatch.from_branch_id,
          destinationBranchId: dispatch.to_branch_id,
          sourceLocation: branchStoreLocation(dispatch.from_branch_id, 'Central Store', true),
          destinationLocation: transitLocation(dispatchId, dispatch.dispatch_number, dispatch.to_branch_id),
          actorId: dispatcherId,
          documentType: 'dispatch_document',
          documentReference: dispatch.dispatch_number,
          reason: `Dispatch ${dispatch.dispatch_number} to branch ${dispatch.to_branch_id}`,
          knownSourceLegacyQuantity: simpleItem?.quantity ?? item.dispatched_quantity,
          metadata: {
            dispatch_id: dispatchId,
            stock_request_id: dispatch.stock_request_id,
            to_branch_id: dispatch.to_branch_id
          }
        });

        // Add to in-transit
        const { error: transitError } = await supabase
          .from('in_transit_stock')
          .insert({
            dispatch_id: dispatchId,
            item_sku: item.item_sku,
            quantity: item.dispatched_quantity
          });

        if (transitError) {
          // Check if it's a duplicate entry (already in transit)
          if (transitError.code === '23505') { // PostgreSQL unique violation
            logger.warn(`Item ${item.item_sku} already in transit for dispatch ${dispatchId}`);
            // Continue - item is already in transit, which is fine
          } else {
            console.error('Database error:', transitError);
            logger.error(`Error adding item ${item.item_sku} to in-transit:`, transitError);
            throw transitError;
          }
        }
      } catch (itemError: any) {
        logger.error(`Error processing item ${item.item_sku}:`, itemError);
        throw new Error(`Error processing item ${item.item_sku}: ${itemError.message}`);
      }
    }

    // Prepare update data
    const updateData: any = {
      status: 'IN_TRANSIT',
      workflow_status: 'in_transit',
      dispatcher_id: dispatcherId,
      dispatched_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add optional fields if provided
    if (updates) {
      if (updates.vehicle_number) updateData.vehicle_number = updates.vehicle_number;
      if (updates.driver_name) updateData.driver_name = updates.driver_name;
      if (updates.driver_phone) updateData.driver_phone = updates.driver_phone;
      if (updates.estimated_delivery) updateData.estimated_delivery = updates.estimated_delivery;
      if (updates.notes) updateData.notes = updates.notes;
    }

    // Update dispatch status and details
    // Note: Status already validated above, no need to filter by status in UPDATE
    const { data: updatedRows, error: updateError } = await supabase
      .from('dispatch_notes')
      .update(updateData)
      .eq('id', dispatchId)
      .select('id, status');

    if (updateError) {
      logger.error(`Error updating dispatch status:`, updateError);
      throw new Error(`Failed to update dispatch status: ${updateError.message}`);
    }

    // Verify the update was successful
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(`Dispatch note ${dispatchId} not found`);
    }

    const verifyDispatch = updatedRows[0];
    if (verifyDispatch.status !== 'IN_TRANSIT') {
      throw new Error('Failed to update dispatch status to IN_TRANSIT');
    }

    if (dispatch.stock_request_id) {
      await supabase
        .from('stock_requests')
        .update({
          status: 'DISPATCHED',
          workflow_status: 'in_transit',
          updated_at: new Date().toISOString()
        })
        .eq('id', dispatch.stock_request_id);
    }

    logger.info(`Dispatch ${dispatch.dispatch_number} sent to transit`);

    return {
      success: true,
      dispatch_id: dispatchId,
      dispatch_number: dispatch.dispatch_number,
      status: 'IN_TRANSIT'
    };
  } catch (error) {
    logger.error(`Error in dispatchItems:`, error);
    throw error;
  }
}

/**
 * Update dispatch logistics (vehicle/driver) after dispatch
 */
export async function updateDispatchLogistics(
  dispatchId: string,
  userId: string,
  updates: {
    vehicle_number?: string;
    driver_name?: string;
    driver_phone?: string;
    estimated_delivery?: string;
    notes?: string;
  }
) {
  // Validate dispatch ID
  if (!dispatchId) {
    throw new Error('Dispatch ID is required');
  }

  // Get dispatch details to verify existence and status
  const { data: dispatch, error: fetchError } = await supabase
    .from('dispatch_notes')
    .select('id, status, dispatch_number')
    .eq('id', dispatchId)
    .maybeSingle();

  if (fetchError) {
    logger.error(`Error fetching dispatch ${dispatchId}:`, fetchError);
    throw new Error(`Dispatch not found: ${fetchError.message}`);
  }

  if (!dispatch) {
    throw new Error('Dispatch note not found');
  }

  // Allow updates only if IN_TRANSIT (or READY, though READY is usually handled by dispatchItems)
  if (!['READY', 'IN_TRANSIT'].includes(dispatch.status)) {
    throw new Error(`Cannot update logistics for dispatch in ${dispatch.status} status`);
  }

  // Update fields
  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (updates.vehicle_number !== undefined) updateData.vehicle_number = updates.vehicle_number;
  if (updates.driver_name !== undefined) updateData.driver_name = updates.driver_name;
  if (updates.driver_phone !== undefined) updateData.driver_phone = updates.driver_phone;
  if (updates.estimated_delivery !== undefined) updateData.estimated_delivery = updates.estimated_delivery;
  if (updates.notes !== undefined) updateData.dispatch_notes = updates.notes; // Note mapping to dispatch_notes col

  const { data: updatedDispatch, error: updateError } = await supabase
    .from('dispatch_notes')
    .update(updateData)
    .eq('id', dispatchId)
    .select();

  if (updateError) {
    logger.error(`Error updating dispatch logistics:`, updateError);
    throw updateError;
  }

  if (!updatedDispatch || updatedDispatch.length === 0) {
    throw new Error('Failed to update dispatch logistics');
  }

  logger.info(`Dispatch ${dispatch.dispatch_number} logistics updated by ${userId}`);

  return updatedDispatch[0];
}

/**
 * Confirm delivery at branch
 */
export async function confirmDelivery(
  dispatchId: string,
  receiverId: string,
  receivedItems: { id: string; received_quantity: number; damaged_quantity?: number; missing_quantity?: number; discrepancy_reason?: string }[],
  deliveryNotes?: string
) {
  // Get dispatch details (try dispatch_notes first, then dispatches)
  let dispatch: any = null;
  let items: any[] = [];
  let tableName: 'dispatch_notes' | 'dispatches' = 'dispatch_notes';

  const { data: noteDispatch, error: noteError } = await supabase
    .from('dispatch_notes')
    .select('*')
    .eq('id', dispatchId)
    .maybeSingle();

  if (noteError && noteError.code !== 'PGRST116') throw noteError;

  if (noteDispatch) {
    if (['CONFIRMED', 'DISPUTED', 'DELIVERED', 'COMPLETED'].includes(noteDispatch.status)) {
      throw new AppError(`Dispatch ${noteDispatch.dispatch_number} has already been confirmed`, 400);
    }
    dispatch = noteDispatch;
    const { data: noteItems, error: noteItemsError } = await supabase
      .from('dispatch_items')
      .select('*')
      .eq('dispatch_id', dispatchId);
    if (noteItemsError) throw noteItemsError;
    items = noteItems || [];
  } else {
    // Fallback to dispatches table
    const { data: disp, error: dispError } = await supabase
      .from('dispatches')
      .select('*')
      .eq('id', dispatchId)
      .maybeSingle();
    if (dispError && dispError.code !== 'PGRST116') throw dispError;
    if (!disp) {
      throw new Error('Dispatch not found');
    }
    dispatch = disp;
    tableName = 'dispatches';
    const { data: lineItems, error: lineError } = await supabase
      .from('dispatch_lines')
      .select('*')
      .eq('dispatch_id', dispatchId);
    if (lineError) throw lineError;
    items = (lineItems || []).map((l: any) => ({
      ...l,
      item_sku: l.item_sku,
      dispatched_quantity: l.packed_quantity,
      received_quantity: l.received_quantity ?? 0,
    }));
  }

  dispatch.items = items;

  // Update each item and add to branch stock
  for (const receivedItem of receivedItems) {
    const itemId = receivedItem.id || (receivedItem as any).item_id;
    if (!itemId) continue;

    const dispatchItem = dispatch.items.find((i: any) => i.id === itemId);
    if (!dispatchItem) continue;

    // Normalize quantity - support both field naming conventions from frontend
    const receivedQty = Math.max(0, Math.round(
      Number((receivedItem as any).received_quantity ?? (receivedItem as any).quantity ?? 0)
    ));
    if (isNaN(receivedQty)) {
      logger.warn(`Invalid quantity for item ${itemId}, skipping stock update`);
      continue;
    }
    const damagedQty = Math.max(0, Number((receivedItem as any).damaged_quantity ?? (receivedItem as any).damaged ?? 0)) || 0;
    const missingQty = Math.max(0, Number((receivedItem as any).missing_quantity ?? (receivedItem as any).missing ?? 0)) || 0;
    const acceptedQty = Math.max(0, receivedQty - damagedQty);
    const receiptStatus =
      damagedQty > 0 ? 'damaged'
        : missingQty > 0 ? 'missing'
          : receivedQty === dispatchItem.dispatched_quantity ? 'matched'
            : receivedQty > 0 ? 'partially_matched'
              : 'rejected';

    // Update dispatch item (correct table)
    if (tableName === 'dispatch_notes') {
      await supabase
        .from('dispatch_items')
        .update({
          received_quantity: receivedQty,
          accepted_quantity: acceptedQty,
          damaged_quantity: damagedQty,
          missing_quantity: missingQty,
          discrepancy_reason: (receivedItem as any).discrepancy_reason || (receivedItem as any).note,
          receipt_status: receiptStatus,
          status: receivedQty === dispatchItem.dispatched_quantity ? 'RECEIVED' : 'PARTIAL'
        })
        .eq('id', itemId);
    } else {
      await supabase
        .from('dispatch_lines')
        .update({
          received_quantity: receivedQty,
          receipt_status: receiptStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);
    }

    if (acceptedQty > 0) {
      const branchId = dispatch.to_branch_id ?? dispatch.destination_branch_id;
      await updateBranchStock(
        branchId,
        dispatchItem.item_sku,
        acceptedQty,
        'DISPATCH_RECEIVE',
        receiverId,
        'DISPATCH',
        dispatchId,
        dispatch.dispatch_number ?? dispatch.id
      );

      const { data: simpleItem } = await supabase
        .from('simple_items')
        .select('item_name, description')
        .eq('sku', dispatchItem.item_sku)
        .maybeSingle();

      await recordFoundationMovementBestEffort({
        movementType: 'transfer',
        sku: dispatchItem.item_sku,
        itemName: simpleItem?.item_name || simpleItem?.description || dispatchItem.item_sku,
        quantity: acceptedQty,
        sourceBranchId: dispatch.to_branch_id,
        destinationBranchId: dispatch.to_branch_id,
        sourceLocation: transitLocation(dispatchId, dispatch.dispatch_number, dispatch.to_branch_id),
        destinationLocation: branchStoreLocation(dispatch.to_branch_id),
        actorId: receiverId,
        documentType: 'receipt_verification',
        documentReference: dispatch.dispatch_number,
        reason: `Branch receipt confirmation for ${dispatch.dispatch_number}`,
        knownSourceLegacyQuantity: acceptedQty,
        metadata: {
          dispatch_id: dispatchId,
          stock_request_id: dispatch.stock_request_id,
          damaged_quantity: damagedQty,
          missing_quantity: missingQty,
          receipt_status: receiptStatus
        }
      });
    }
  }

  // Clear in-transit
  await supabase
    .from('in_transit_stock')
    .delete()
    .eq('dispatch_id', dispatchId);

  // Check if any discrepancies
  const hasDiscrepancies = receivedItems.some(
    i => (i.damaged_quantity || 0) > 0 || (i.missing_quantity || 0) > 0
  );
  const receiptStatus = hasDiscrepancies ? 'partially_matched' : 'matched';

  // Update dispatch status (correct table)
  if (tableName === 'dispatch_notes') {
    const { error: updateError } = await supabase
      .from('dispatch_notes')
      .update({
        status: hasDiscrepancies ? 'DISPUTED' : 'CONFIRMED',
        workflow_status: 'received',
        receipt_status: receiptStatus,
        receiver_id: receiverId,
        delivered_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        receipt_verified_at: new Date().toISOString(),
        delivery_notes: deliveryNotes,
        receipt_notes: deliveryNotes,
        discrepancy_notes: hasDiscrepancies ? 'Discrepancies reported' : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', dispatchId);
    if (updateError) throw updateError;
  } else {
    const { error: updateError } = await supabase
      .from('dispatches')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', dispatchId);
    if (updateError) throw updateError;
    // Log to dispatch_audit_log
    await supabase.from('dispatch_audit_log').insert({
      dispatch_id: dispatchId,
      action: 'branch_receipt_confirmed',
      performed_by: receiverId,
      notes: `Branch confirmed receipt${deliveryNotes ? ': ' + deliveryNotes : ''}`
    });
  }

  // Update original request (only for dispatch_notes flow)
  if (tableName === 'dispatch_notes' && dispatch.stock_request_id) {
    await supabase
      .from('stock_requests')
      .update({
        status: 'DELIVERED',
        workflow_status: hasDiscrepancies ? 'verified' : 'received',
        updated_at: new Date().toISOString()
      })
      .eq('id', dispatch.stock_request_id);

    const { data: updatedDispatchItems } = await supabase
      .from('dispatch_items')
      .select('*')
      .eq('dispatch_id', dispatchId);

    if (updatedDispatchItems) {
      for (const dItem of updatedDispatchItems) {
        await supabase
          .from('stock_request_items')
          .update({
            status: 'DELIVERED',
            approved_quantity: dItem.received_quantity,
            updated_at: new Date().toISOString()
          })
          .match({
            request_id: dispatch.stock_request_id,
            item_sku: dItem.item_sku
          });
      }
    }
  }

  logger.info(`Dispatch ${dispatch.dispatch_number ?? dispatchId} confirmed at branch`);

  return { status: tableName === 'dispatch_notes' ? (hasDiscrepancies ? 'DISPUTED' : 'CONFIRMED') : 'COMPLETED' };
}

/**
 * Get incoming dispatches for a branch
 */
export async function getIncomingDispatches(branchId: number) {
  // dispatch_notes table: to_branch_id, from_branch_id, status (uppercase)
  const { data: dispatches, error } = await supabase
    .from('dispatch_notes')
    .select('*')
    .eq('to_branch_id', branchId)
    .in('status', ['IN_TRANSIT', 'DELIVERED', 'CONFIRMED', 'READY'])
    .order('dispatched_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  if (!dispatches || dispatches.length === 0) return [];

  // Get source branches
  const branchIds = [...new Set(dispatches.map((d: any) => d.from_branch_id).filter(Boolean))];
  const { data: branches } = branchIds.length > 0 ? await supabase
    .from('branches')
    .select('id, name, code')
    .in('id', branchIds) : { data: [] };

  // Get dispatch items + simple item details
  const dispatchIds = dispatches.map((d: any) => d.id);
  const { data: dispatchItems } = await supabase
    .from('dispatch_items')
    .select('*')
    .in('dispatch_id', dispatchIds);

  // Enrich with item names from simple_items
  const skus = [...new Set((dispatchItems || []).map((i: any) => i.item_sku).filter(Boolean))];
  const { data: itemDetails } = skus.length > 0 ? await supabase
    .from('simple_items')
    .select('sku, item_name, unit')
    .in('sku', skus) : { data: [] };
  const itemMap = new Map((itemDetails || []).map((i: any) => [i.sku, i]));

  return dispatches.map((dispatch: any) => ({
    ...dispatch,
    from_branch: (branches || []).find((b: any) => b.id === dispatch.from_branch_id) || null,
    items: (dispatchItems || [])
      .filter((i: any) => i.dispatch_id === dispatch.id)
      .map((item: any) => {
        const detail = itemMap.get(item.item_sku);
        return {
          ...item,
          item_name: detail?.item_name || item.item_sku,
          unit: item.unit || detail?.unit || 'units',
          quantity: item.dispatched_quantity,
        };
      })
  }));
}

/**
 * Get dispatch history from central
 */
export async function getDispatchHistory(fromBranchId: number, status?: string, storeType?: string) {
  let query = supabase
    .from('dispatch_notes')
    .select('*')
    .eq('from_branch_id', fromBranchId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data: dispatches, error } = await query;
  if (error) throw error;
  if (!dispatches || dispatches.length === 0) return [];

  // Get metadata for enrichment
  const toBranchIds = [...new Set(dispatches.map(d => d.to_branch_id))];
  const vehicleIds = [...new Set(dispatches.map(d => d.vehicle_id).filter(id => id))];
  const driverIds = [...new Set(dispatches.map(d => d.driver_id).filter(id => id))];
  const dispatchIds = dispatches.map(d => d.id);

  // Fetch all enrichment data in parallel (no FK join for dispatch_items → simple_items)
  const [branchesRes, vehiclesRes, driversRes, itemsRes] = await Promise.all([
    supabase.from('branches').select('id, name, code').in('id', toBranchIds),
    vehicleIds.length > 0 ? supabase.from('vehicles').select('id, registration_number, model').in('id', vehicleIds) : Promise.resolve({ data: [] }),
    driverIds.length > 0 ? supabase.from('drivers').select('id, name, license_number, phone').in('id', driverIds) : Promise.resolve({ data: [] }),
    supabase.from('dispatch_items').select('id, dispatch_id, item_sku, dispatched_quantity, received_quantity, created_at').in('dispatch_id', dispatchIds)
  ]);

  const branches = branchesRes.data || [];
  const vehicles = vehiclesRes.data || [];
  const drivers = driversRes.data || [];
  const dispatchItems = itemsRes.data || [];

  // Fetch item details separately (no FK exists between dispatch_items and simple_items)
  const allSkus = [...new Set(dispatchItems.map(i => i.item_sku).filter(Boolean))];
  let itemDetails: any[] = [];
  if (allSkus.length > 0) {
    const { data: details } = await supabase
      .from('simple_items')
      .select('sku, item_name, description, unit_of_measure, cost_price, store_type')
      .in('sku', allSkus);
    itemDetails = details || [];
  }

  const mappedDispatches = dispatches.map(dispatch => {
    const toBranch = branches.find(b => b.id === dispatch.to_branch_id);
    const vehicle = vehicles.find(v => v.id === dispatch.vehicle_id);
    const driver = drivers.find(d => d.id === dispatch.driver_id);

    return {
      ...dispatch,
      to_branch: toBranch,
      to_branch_name: toBranch?.name || 'Unknown Branch',
      vehicle,
      vehicle_registration: dispatch.vehicle_number || vehicle?.registration_number,
      driver,
      driver_name: dispatch.driver_name || driver?.name,
      items: dispatchItems
        .filter(i => i.dispatch_id === dispatch.id)
        .map(i => {
          const detail = itemDetails.find(d => d.sku === i.item_sku);
          return {
            id: i.id,
            item_sku: i.item_sku,
            item_name: detail?.item_name || i.item_sku,
            quantity: i.dispatched_quantity,
            cost_price: detail?.cost_price || 0,
            unit: detail?.unit_of_measure || 'units',
            store_type: detail?.store_type || 'foodstuffs'
          };
        })
    };
  });

  if (storeType) {
    return mappedDispatches.filter(d => 
      d.items.some((i: any) => i.store_type === storeType)
    );
  }

  return mappedDispatches;
}

// ============================================================
// CENTRAL WAREHOUSE HELPERS
// ============================================================

/**
 * Get central warehouse branch
 */
export async function getCentralWarehouse() {
  const { data: kyogong, error: kyogongError } = await supabase
    .from('branches')
    .select('*')
    .eq('id', KYOGONG_CENTRAL_BRANCH_ID)
    .maybeSingle();

  if (kyogongError) throw kyogongError;

  if (kyogong && (kyogong.code === KYOGONG_BRANCH_CODE || String(kyogong.name || '').toLowerCase() === 'kyogong')) {
    if (!kyogong.is_central_warehouse) {
      logger.warn('Kyogong branch found but is_central_warehouse=false; treating Kyogong as central warehouse');
    }
    return kyogong;
  }

  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('is_central_warehouse', true)
    .maybeSingle();

  if (error) throw error;

  if (data) return data;

  // Fallback: use the main branch if no central warehouse is designated
  logger.warn('No central warehouse found, falling back to is_main_branch=true');
  const { data: mainBranch, error: mainError } = await supabase
    .from('branches')
    .select('*')
    .eq('is_main_branch', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (mainError) throw mainError;
  return mainBranch;
}

/**
 * Check if user is central storekeeper
 */
export async function isCentralStorekeeper(userId: string, branchId: number): Promise<boolean> {
  const { data: branch } = await supabase
    .from('branches')
    .select('is_central_warehouse')
    .eq('id', branchId)
    .maybeSingle();

  return branch?.is_central_warehouse === true;
}

/**
 * Get all branches (for central to dispatch to)
 */
export async function getAllBranches() {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('status', 'active')
    .order('name');

  if (error) throw error;
  return data;
}

/**
 * Get dashboard stats for central
 */
export async function getCentralDashboardStats() {
  try {
    const [pendingRequests, inTransit, lowStock, recentDispatches, totalMaster] = await Promise.all([
      supabase.from('stock_requests').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'PENDING_AUDIT', 'UNDER_REVIEW', 'PENDING_BRANCH_ACCOUNTANT_APPROVAL']),
      supabase.from('dispatch_notes').select('*', { count: 'exact', head: true }).in('status', ['READY', 'DISPATCHED', 'IN_TRANSIT']),
      supabase.from('branch_stock').select('*', { count: 'exact', head: true }).lte('quantity', 10), // Threshold default
      supabase.from('dispatch_notes').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('simple_items').select('*', { count: 'exact', head: true }).eq('is_active', true)
    ]);

    // For better low stock accuracy across catalog
    // We try to get this from simple_items where quantity <= reorder_level
    // This is hard to do in one PostgREST call without RPC, so we'll use a count of those that fall below 
    // BUT since we can't compare columns easily, we'll use a conservative threshold for now or 
    // a separate query for those explicitly marked.
    const { count: globalLowStock } = await supabase
      .from('simple_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .filter('quantity', 'lte', 10); // Still using numeric for reliability

    return {
      pendingRequests: pendingRequests?.count || 0,
      inTransit: inTransit?.count || 0,
      lowStockBranches: lowStock?.count || 0,
      weeklyDispatches: recentDispatches?.count || 0,
      totalMasterItems: totalMaster?.count || 0,
      totalLowStockItems: globalLowStock || 0
    };
  } catch (error) {
    logger.error('Error fetching central dashboard stats:', error);
    return {
      pendingRequests: 0,
      inTransit: 0,
      lowStockBranches: 0,
      weeklyDispatches: 0,
      totalMasterItems: 0,
      totalLowStockItems: 0
    };
  }
}

/**
 * Get dashboard stats for branch
 */
export async function getBranchDashboardStats(branchId: number) {
  const [totalItemsRes, allStockRes, pendingRequestsRes, incomingDispatchesRes] = await Promise.all([
    supabase.from('branch_stock').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
    supabase.from('branch_stock').select('id, quantity, reorder_level').eq('branch_id', branchId),
    supabase.from('stock_requests').select('id', { count: 'exact', head: true }).eq('requesting_branch_id', branchId).in('status', ['PENDING', 'PENDING_AUDIT', 'APPROVED', 'UNDER_REVIEW', 'PENDING_BRANCH_ACCOUNTANT_APPROVAL']),
    supabase.from('dispatch_notes').select('id', { count: 'exact', head: true }).eq('to_branch_id', branchId).eq('status', 'IN_TRANSIT')
  ]);

  // Low stock = items where quantity <= reorder_level
  const allStock = allStockRes.data || [];
  const lowStockCount = allStock.filter(item => Number(item.quantity || 0) <= Number(item.reorder_level || 10)).length;

  return {
    totalItems: totalItemsRes.count || 0,
    lowStock: lowStockCount,
    lowStockItems: lowStockCount,
    pendingRequests: pendingRequestsRes.count || 0,
    incomingDispatches: incomingDispatchesRes.count || 0
  };
}

/**
 * Record stock conversion (Yield Control)
 */
export async function recordConversion(
  branchId: number,
  userId: string,
  rawSku: string,
  rawQty: number,
  producedSku: string,
  producedQty: number,
  notes?: string
) {
  // 1. Validate Raw Item Stock
  const { data: rawStock, error: rawError } = await supabase
    .from('branch_stock')
    .select('quantity')
    .eq('branch_id', branchId)
    .eq('item_sku', rawSku)
    .maybeSingle();

  if (rawError && rawError.code !== 'PGRST116') throw rawError;
  const currentRawQty = rawStock?.quantity || 0;

  if (currentRawQty < rawQty) {
    throw new Error(`Insufficient stock for ${rawSku}. Current: ${currentRawQty}, Required: ${rawQty}`);
  }

  // 2. Validate Produced Item exists in catalog (optional but good)
  const { data: producedItem, error: prodError } = await supabase
    .from('simple_items')
    .select('item_name')
    .eq('sku', producedSku)
    .maybeSingle();

  const producedItemName = producedItem?.item_name || producedSku;

  // 3. Deduct Raw Item
  await updateBranchStock(
    branchId,
    rawSku,
    -rawQty,
    'CONVERSION_OUT',
    userId,
    'CONVERSION',
    undefined,
    undefined,
    `Converted to ${producedQty} of ${producedItemName}. ${notes || ''}`
  );

  // 4. Add Produced Item
  await updateBranchStock(
    branchId,
    producedSku,
    producedQty,
    'CONVERSION_IN',
    userId,
    'CONVERSION',
    undefined,
    undefined,
    `Converted from ${rawQty} of ${rawSku}. ${notes || ''}`
  );

  return {
    success: true,
    message: `Converted ${rawQty} ${rawSku} to ${producedQty} ${producedSku}`
  };
}
