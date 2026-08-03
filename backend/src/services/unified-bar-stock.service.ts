/**
 * Unified Bar Stock Service
 * =========================
 * Single source of truth for bar stock across:
 *   - inventory_balances      (new foundation schema)
 *   - bar_stock               (legacy bar inventory screen)
 *   - pos_outlet_items        (legacy POS display)
 *   - pos_shift_stock_counts  (per-shift tracking)
 *
 * Restaurant POS outlets are NEVER touched by this service.
 */

import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const BAR_OUTLET_TYPES = new Set([
  'main_bar',
  'executive_bar',
  'sports_bar',
  'kyogong_executive_bar',
  'kyogong_sports_bar'
]);

interface RecordBarStockMovementInput {
  branchId: number;
  outletId?: string | null;
  drinkId?: string | null;
  sku?: string | null;
  quantityDelta: number;   // + for receipt/restock, - for sale/waste
  movementType:
    | 'sale'
    | 'sale_reversal'
    | 'restock'
    | 'dispatch_receive'
    | 'stock_take_adjustment'
    | 'waste'
    | 'production';
  referenceId?: string | null;
  referenceNumber?: string | null;
  performedBy?: string | null;
  notes?: string | null;
  costPerUnit?: number | null;
  shiftId?: string | null;
  auditQuantity?: number | null;
}

interface BarStockResult {
  drinkId: string | null;
  sku: string | null;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minStock: number;
  source: 'inventory_balances' | 'bar_stock' | 'none';
}

/**
 * Resolve the item SKU and drink_id from either drinkId or sku.
 */
async function resolveBarItem(
  branchId: number,
  drinkId?: string | null,
  sku?: string | null
): Promise<{ drinkId: string | null; sku: string | null; itemId: string | null }> {
  if (!drinkId && !sku) {
    throw new Error('Either drinkId or sku is required');
  }

  // Resolve SKU from drink_id
  if (drinkId && !sku) {
    const { data: drink } = await supabase
      .from('bar_drinks')
      .select('id, name, sku')
      .eq('id', drinkId)
      .maybeSingle();
    if (drink) {
      return {
        drinkId: drink.id,
        sku: drink.sku || `BAR-${drink.id}`,
        itemId: null
      };
    }
  }

  // Resolve drink_id from SKU
  if (sku && !drinkId) {
    const { data: drink } = await supabase
      .from('bar_drinks')
      .select('id, sku')
      .eq('sku', sku)
      .maybeSingle();
    if (drink) {
      return {
        drinkId: drink.id,
        sku: drink.sku || `BAR-${drink.id}`,
        itemId: null
      };
    }

    // Fallback: try to find inventory_items
    const { data: invItem } = await supabase
      .from('inventory_items')
      .select('id, sku')
      .eq('sku', sku)
      .maybeSingle();
    if (invItem) {
      return { drinkId: null, sku: invItem.sku, itemId: invItem.id };
    }
  }

  return { drinkId: drinkId || null, sku: sku || null, itemId: null };
}

/**
 * Resolve inventory_location_id for a bar outlet.
 */
async function resolveBarOutletLocation(
  branchId: number,
  outletId?: string | null
): Promise<{ locationId: string | null; outletId: string | null }> {
  let query = supabase
    .from('pos_outlets')
    .select('id, inventory_location_id, outlet_type')
    .eq('branch_id', branchId)
    .in('outlet_type', Array.from(BAR_OUTLET_TYPES));

  if (outletId) {
    query = query.eq('id', outletId);
  }

  if (outletId) {
    const { data: outlet } = await query.maybeSingle();

    if (outlet?.inventory_location_id) {
      return { locationId: outlet.inventory_location_id, outletId: outlet.id };
    }

    if (outlet?.id && outlet?.outlet_type) {
      const locationCode = `BAR-${outlet.outlet_type}-${branchId}`;
      const { data: existingLoc } = await supabase
        .from('inventory_locations')
        .select('id')
        .eq('branch_id', branchId)
        .eq('location_code', locationCode)
        .maybeSingle();

      if (existingLoc?.id) {
        return { locationId: existingLoc.id, outletId: outlet.id };
      }
    }

    return { locationId: null, outletId: outlet?.id || outletId };
  }

  const { data: outlets } = await query;
  if ((outlets || []).length === 1) {
    const outlet = outlets![0];
    if (outlet?.inventory_location_id) {
      return { locationId: outlet.inventory_location_id, outletId: outlet.id };
    }

    if (outlet?.id && outlet?.outlet_type) {
      const locationCode = `BAR-${outlet.outlet_type}-${branchId}`;
      const { data: existingLoc } = await supabase
        .from('inventory_locations')
        .select('id')
        .eq('branch_id', branchId)
        .eq('location_code', locationCode)
        .maybeSingle();

      if (existingLoc?.id) {
        return { locationId: existingLoc.id, outletId: outlet.id };
      }
    }
  }

  return { locationId: null, outletId: null };
}

/**
 * Resolve inventory_item_id from SKU, creating one if needed.
 * Auto-created rows are tagged with the owning branch's branch_id so a
 * branch's own bar-menu items stay scoped to that branch instead of
 * silently joining the shared/central catalog (which inflates central
 * store's master inventory count — see items.controller.ts getItems).
 */
async function resolveInventoryItemId(sku: string, branchId: number): Promise<string | null> {
  const { data: existing } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('sku', sku)
    .maybeSingle();

  if (existing) return existing.id;

  // Try to create from bar_drinks
  const { data: drink } = await supabase
    .from('bar_drinks')
    .select('id, name, category, unit, cost_price, price, selling_price, min_stock, sku, category_id, is_available')
    .or(`sku.eq.${sku},id.eq.${sku.replace('BAR-', '')}`)
    .maybeSingle();

  if (!drink) return null;

  const { data: category } = await supabase
    .from('bar_drink_categories')
    .select('name')
    .eq('id', drink.category_id)
    .maybeSingle();

  const { data: inserted } = await supabase
    .from('inventory_items')
    .insert({
      sku: drink.sku || `BAR-${drink.id}`,
      item_name: drink.name,
      category: category?.name || 'bar',
      unit: drink.unit || 'bottle',
      item_type: 'menu_item',
      default_unit_cost: drink.cost_price || 0,
      default_selling_price: drink.price || drink.selling_price || 0,
      reorder_level: drink.min_stock || 5,
      is_active: drink.is_available !== false,
      branch_id: branchId,
      metadata: { source: 'bar_drinks', source_id: drink.id }
    })
    .select('id')
    .single();

  return inserted?.id || null;
}

/**
 * Record a bar stock movement. Atomically updates:
 *   1. inventory_balances (source of truth)
 *   2. bar_stock (legacy screen)
 *   3. pos_outlet_items (legacy POS)
 *   4. pos_shift_stock_counts (shift tracking)
 *   5. inventory_movements (audit trail)
 */
export async function recordBarStockMovement(
  input: RecordBarStockMovementInput
): Promise<{ previousStock: number; newStock: number; source: string }> {
  const {
    branchId,
    outletId: inputOutletId,
    drinkId: inputDrinkId,
    sku: inputSku,
    quantityDelta,
    movementType,
    referenceId,
    referenceNumber,
    performedBy,
    notes,
    costPerUnit,
    shiftId,
    auditQuantity
  } = input;

  // ── Resolve identifiers ────────────────────────────────────────────
  const resolved = await resolveBarItem(branchId, inputDrinkId, inputSku);
  const sku = resolved.sku || '';
  const drinkId = resolved.drinkId;
  let itemId = resolved.itemId;

  if (!sku) {
    throw new Error('Could not resolve SKU for bar item');
  }

  if (!itemId && drinkId) {
    itemId = await resolveInventoryItemId(sku, branchId);
  }

  const { locationId, outletId } = await resolveBarOutletLocation(branchId, inputOutletId);

  // ── Step 1: Update inventory_balances (source of truth) ─────────────
  let previousStock = 0;
  let newStock = 0;
  let source = 'none';

  if (itemId && locationId) {
    try {
      const { data: balance } = await supabase
        .from('inventory_balances')
        .select('id, current_quantity')
        .eq('item_id', itemId)
        .eq('location_id', locationId)
        .is('batch_id', null)
        .maybeSingle();

      previousStock = toNumber(balance?.current_quantity);
      newStock = Math.max(0, previousStock + quantityDelta);

      if (balance?.id) {
        const { error: balError } = await supabase
          .from('inventory_balances')
          .update({
            current_quantity: newStock,
            unit_cost: costPerUnit !== undefined && costPerUnit !== null ? costPerUnit : undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', balance.id);
        if (balError) throw balError;
      } else {
        const { error: insertBalError } = await supabase
          .from('inventory_balances')
          .insert({
            item_id: itemId,
            location_id: locationId,
            current_quantity: newStock,
            unit_cost: costPerUnit || 0,
            reserved_quantity: 0,
            damaged_quantity: 0,
            expired_quantity: 0
          });
        if (insertBalError) throw insertBalError;
      }
      source = 'inventory_balances';
    } catch (balErr: any) {
      previousStock = 0;
      newStock = 0;
      source = 'none';
      logger.warn(`Bar stock movement: inventory_balances update failed for item ${itemId}:`, balErr?.message || balErr);
    }
  }

  // ── Step 2: Update bar_stock (legacy) ──────────────────────────────
  // Isolated in its own try/catch — this is the screen the storekeeper
  // actually looks at, so it must not be skipped just because an earlier
  // or later step (inventory_balances, audit log, ledger) has a problem.
  if (drinkId) {
    try {
      let barQuery = supabase
        .from('bar_stock')
        .select('id, current_stock, outlet_id')
        .eq('branch_id', branchId)
        .eq('drink_id', drinkId);

      if (outletId) {
        barQuery = barQuery.eq('outlet_id', outletId);
      }

      const { data: barStock } = await barQuery.maybeSingle();

      if (barStock?.id) {
        const barNewStock = Math.max(0, toNumber(barStock.current_stock) + quantityDelta);
        const { error: barUpdateError } = await supabase
          .from('bar_stock')
          .update({
            current_stock: barNewStock,
            last_updated: new Date().toISOString()
          })
          .eq('id', barStock.id);
        if (barUpdateError) throw barUpdateError;
      } else {
        // Create bar_stock row if missing
        const { error: barInsertError } = await supabase
          .from('bar_stock')
          .insert({
            branch_id: branchId,
            outlet_id: outletId,
            drink_id: drinkId,
            item_sku: sku,
            item_name: sku,
            current_stock: Math.max(0, quantityDelta),
            unit: 'bottle',
            par_level: 5
          });
        if (barInsertError) throw barInsertError;
      }
    } catch (barErr: any) {
      logger.warn(`Bar stock movement: bar_stock update failed for drink ${drinkId}:`, barErr?.message || barErr, barErr?.details || '');
    }
  }

  // ── Step 2b: Sync branch_stock for sales ───────────────────────────
  // branch_stock is keyed by the CENTRAL catalog sku (inventory_items.sku,
  // e.g. FG-190), not the POS sku (M-<uuid>) — resolve it via
  // bar_drinks.inventory_item_id. Only sales/reversals post here: receipts
  // from the central store (DISPATCH_RECEIVE) and suppliers (SUPPLIER_RECEIPT)
  // already credit branch_stock through their own flows, so crediting
  // restock/dispatch_receive here would double-count every receipt.
  if (drinkId && (movementType === 'sale' || movementType === 'sale_reversal')) {
    try {
      const { data: drinkLink } = await supabase
        .from('bar_drinks')
        .select('inventory_item_id')
        .eq('id', drinkId)
        .maybeSingle();

      let branchSku: string | null = null;
      if (drinkLink?.inventory_item_id) {
        const { data: invItem } = await supabase
          .from('inventory_items')
          .select('sku')
          .eq('id', drinkLink.inventory_item_id)
          .maybeSingle();
        branchSku = invItem?.sku || null;
      }

      if (branchSku) {
        const { data: branchRow } = await supabase
          .from('branch_stock')
          .select('id, quantity')
          .eq('branch_id', branchId)
          .eq('item_sku', branchSku)
          .maybeSingle();

        if (branchRow?.id) {
          const branchPrev = toNumber(branchRow.quantity);
          const branchNext = Math.max(0, branchPrev + quantityDelta);
          const { error: branchUpdateError } = await supabase
            .from('branch_stock')
            .update({
              quantity: branchNext,
              current_stock: branchNext,
              ...(quantityDelta < 0
                ? { last_stock_out: new Date().toISOString() }
                : { last_stock_in: new Date().toISOString() }),
              updated_at: new Date().toISOString()
            })
            .eq('id', branchRow.id);
          if (branchUpdateError) throw branchUpdateError;

          // The shift-close automation dedupes its aggregate SALE posting on
          // (branch_id, item_sku, reference_id, movement_type) — logging the
          // per-sale movement under the shift id keeps the two paths from
          // double-decrementing the same shift's sales.
          const { error: branchMovementError } = await supabase
            .from('branch_stock_movements')
            .insert({
              branch_id: branchId,
              item_sku: branchSku,
              movement_type: movementType === 'sale' ? 'SALE' : 'SALE_REVERSAL',
              quantity: Math.abs(quantityDelta),
              previous_stock: branchPrev,
              new_stock: branchNext,
              reference_type: 'POS_SHIFT',
              reference_id: shiftId || referenceId || null,
              reference_number: referenceNumber || null,
              performed_by: performedBy || null,
              shift_id: shiftId || null,
              notes: notes || `POS bar ${movementType}`
            });
          if (branchMovementError) throw branchMovementError;
        }
      }
    } catch (branchErr: any) {
      logger.warn(`Bar stock movement: branch_stock sync failed for drink ${drinkId}:`, branchErr?.message || branchErr);
    }
  }

  // ── Step 3: Update pos_outlet_items (legacy POS) ───────────────────
  if (outletId) {
    try {
      const { data: posItem } = await supabase
        .from('pos_outlet_items')
        .select('id, current_stock')
        .eq('outlet_id', outletId)
        .or(`sku.eq.${sku},source_item_id.eq.${drinkId || ''}`)
        .maybeSingle();

      if (posItem?.id) {
        const posNewStock = Math.max(0, toNumber(posItem.current_stock) + quantityDelta);
        const { error: posUpdateError } = await supabase
          .from('pos_outlet_items')
          .update({
            current_stock: posNewStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', posItem.id);
        if (posUpdateError) throw posUpdateError;
      }
    } catch (posErr: any) {
      logger.warn(`Bar stock movement: pos_outlet_items update failed for sku ${sku}:`, posErr?.message || posErr);
    }
  }

  // ── Step 4: Update pos_shift_stock_counts ─────────────────────────
  let targetShiftId = shiftId;
  if (!targetShiftId && outletId) {
    const { data: openShift } = await supabase
      .from('pos_outlet_shifts')
      .select('id')
      .eq('outlet_id', outletId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    targetShiftId = openShift?.id || null;
  }

  if (targetShiftId && outletId) {
    try {
      const { data: countRow } = await supabase
        .from('pos_shift_stock_counts')
        .select('id, opening_stock, additions, sold_quantity, system_closing_stock, physical_count')
        .eq('shift_id', targetShiftId)
        .eq('sku', sku)
        .maybeSingle();

      if (countRow?.id) {
        let newSold = toNumber(countRow.sold_quantity);
        let newAdditions = toNumber(countRow.additions);
        const mt = String(movementType || '').toLowerCase();
        const qty = Math.abs(quantityDelta);

        if (mt === 'sale') {
          // A real sale reduces stock and IS revenue.
          newSold = Math.max(0, newSold + qty);
        } else if (
          mt === 'sale_reversal' || mt === 'void' || mt === 'void_reversal' ||
          mt === 'waste' || mt === 'spoilage'
        ) {
          // A VOID must never count as a sale. Reverse the original sale.
          //  - returned-to-stock: the item is back, so reducing sold raises the
          //    system closing again (net stock effect zero).
          //  - broken/wasted: it's not revenue either; the stock loss surfaces
          //    as a physical-count variance the accountant can mark as spoilage.
          newSold = Math.max(0, newSold - qty);
        } else if (quantityDelta > 0) {
          // Genuine restock / production receipt into the outlet.
          newAdditions = newAdditions + quantityDelta;
        }
        // Any other negative adjustment intentionally leaves sold/additions
        // untouched so it never inflates sales; it surfaces via variance.

        const newSysClosing = toNumber(countRow.opening_stock) + newAdditions - newSold;

        const { error: countUpdateError } = await supabase
          .from('pos_shift_stock_counts')
          .update({
            sold_quantity: newSold,
            additions: newAdditions,
            system_closing_stock: newSysClosing,
            variance: countRow.physical_count === null || countRow.physical_count === undefined
              ? 0
              : toNumber(countRow.physical_count) - newSysClosing,
            updated_at: new Date().toISOString()
          })
          .eq('id', countRow.id);
        if (countUpdateError) throw countUpdateError;
      }
    } catch (countErr: any) {
      logger.warn(`Bar stock movement: pos_shift_stock_counts update failed for sku ${sku}:`, countErr?.message || countErr);
    }
  }

  // ── Step 5: Log inventory_movement ─────────────────────────────────
  if (itemId && locationId) {
    const { error: movError } = await supabase
      .from('inventory_movements')
      .insert({
        branch_id: branchId,
        movement_type: movementType,
        item_id: itemId,
        source_location_id: quantityDelta < 0 || movementType === 'waste' ? locationId : null,
        destination_location_id: quantityDelta >= 0 && movementType !== 'waste' ? locationId : null,
        quantity: auditQuantity !== undefined && auditQuantity !== null ? auditQuantity : Math.abs(quantityDelta),
        reason: notes || movementType,
        document_type: referenceId ? 'order' : 'manual',
        document_number: referenceNumber || referenceId || null,
        actor_id: performedBy || null
      });

    if (movError) {
      logger.warn('Bar stock movement audit log failed (non-critical):', movError.message);
    }
  }

  // ── Step 6: Log bar_stock_ledger (legacy audit) ────────────────────
  if (drinkId) {
    const { error: ledgerError } = await supabase
      .from('bar_stock_ledger')
      .insert({
        branch_id: branchId,
        drink_id: drinkId,
        transaction_type: movementType === 'sale' ? 'sale' :
                          movementType === 'sale_reversal' ? 'sale_reversal' :
                          movementType === 'restock' ? 'restock' :
                          movementType === 'dispatch_receive' ? 'restock' :
                          movementType === 'stock_take_adjustment' ? 'stock_take' :
                          movementType === 'production' ? 'restock' :
                          movementType === 'waste' ? 'waste' :
                          'adjustment',
        quantity: auditQuantity !== undefined && auditQuantity !== null ? auditQuantity : Math.abs(quantityDelta),
        opening_balance: previousStock,
        closing_balance: newStock,
        reference: referenceNumber || notes || movementType,
        performed_by: performedBy || null
      });

    if (ledgerError) {
      logger.warn('Bar stock ledger insert failed (non-critical):', ledgerError.message);
    }
  }

  logger.info(`Bar stock ${movementType}: ${sku} branch ${branchId} ${previousStock} -> ${newStock} (delta ${quantityDelta})`);

  return { previousStock, newStock, source };
}

/**
 * Get unified bar stock for a branch (optionally filtered by outlet).
 * Returns live data from inventory_balances when available,
 * falling back to bar_stock, then pos_outlet_items.
 */
export async function getBarStock(
  branchId: number,
  outletId?: string | null
): Promise<BarStockResult[]> {
  const resolvedLocation = await resolveBarOutletLocation(branchId, outletId);
  const locationId = resolvedLocation.locationId;
  const resolvedOutletId = resolvedLocation.outletId;

  // Get all bar drinks for this branch (global + branch-specific)
  const { data: drinks, error: drinksError } = await supabase
    .from('bar_drinks')
    .select(`
      id, name, sku, unit, price, selling_price, cost_price, min_stock, is_available,
      category:bar_drink_categories(name)
    `)
    .eq('branch_id', branchId)
    .eq('is_available', true)
    .order('name');

  if (drinksError) throw drinksError;

  if (!drinks || drinks.length === 0) return [];

  const drinkIds = drinks.map((d: any) => d.id);
  const skus = drinks.map((d: any) => d.sku || `BAR-${d.id}`).filter(Boolean);

  // Get inventory_balances keyed by SKU for lookup
  let skuToBalance: Record<string, { current_quantity: number; unit_cost: number }> = {};
  if (locationId && skus.length > 0) {
    const { data: invItems } = await supabase
      .from('inventory_items')
      .select('id, sku')
      .in('sku', skus);

    const itemIds = (invItems || []).map((i: any) => i.id);
    const skuByItemId = Object.fromEntries(
      (invItems || []).map((i: any) => [i.id, i.sku])
    );

    if (itemIds.length > 0) {
      const { data: balData } = await supabase
        .from('inventory_balances')
        .select('item_id, current_quantity, unit_cost')
        .eq('location_id', locationId)
        .in('item_id', itemIds);

      skuToBalance = Object.fromEntries(
        (balData || []).map((b: any) => [skuByItemId[b.item_id], b]).filter((e: any) => e[0])
      );
    }
  }

  // Get bar_stock fallback
  let barStockRows: any[] = [];
  if (resolvedOutletId) {
    const { data } = await supabase
      .from('bar_stock')
      .select('drink_id, current_stock, par_level, last_updated, outlet_id')
      .eq('branch_id', branchId)
      .eq('outlet_id', resolvedOutletId)
      .in('drink_id', drinkIds);
    barStockRows = data || [];
  }

  const barStockByDrinkId = Object.fromEntries(
    (barStockRows || []).map((s: any) => [s.drink_id, s])
  );

  // Get pos_outlet_items fallback
  let posItemsBySku: Record<string, { current_stock: number; selling_price: number }> = {};
  if (resolvedOutletId) {
    const { data: posItems } = await supabase
      .from('pos_outlet_items')
      .select('sku, current_stock, selling_price')
      .eq('outlet_id', resolvedOutletId)
      .in('sku', skus);

    posItemsBySku = Object.fromEntries(
      (posItems || []).map((p: any) => [p.sku, p])
    );
  }

  // Build unified result
  return drinks.map((drink: any) => {
    const sku = drink.sku || `BAR-${drink.id}`;
    const bal = skuToBalance[sku];
    const bar = barStockByDrinkId[drink.id];
    const pos = posItemsBySku[sku];

    // Determine current stock source
    let currentStock = 0;
    let stockSource: 'inventory_balances' | 'bar_stock' | 'none' = 'none';

    if (bal) {
      currentStock = toNumber(bal.current_quantity);
      stockSource = 'inventory_balances';
    } else if (bar) {
      currentStock = toNumber(bar.current_stock);
      stockSource = 'bar_stock';
    } else if (pos) {
      currentStock = toNumber(pos.current_stock);
      stockSource = 'bar_stock'; // Treat pos_outlet as bar_stock source
    }

    const category = drink.category?.name || drink.category || 'bar';

    return {
      drinkId: drink.id,
      sku,
      name: drink.name,
      category,
      unit: drink.unit || 'bottle',
      costPrice: toNumber(drink.cost_price),
      sellingPrice: toNumber(drink.price ?? drink.selling_price),
      currentStock,
      minStock: toNumber(drink.min_stock),
      source: stockSource
    };
  });
}

/**
 * Get complete bar stock ledger (audit trail).
 */
export async function getBarStockLedger(
  branchId: number,
  drinkId?: string | null,
  limit = 100
): Promise<any[]> {
  let query = supabase
    .from('bar_stock_ledger')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (drinkId) query = query.eq('drink_id', drinkId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
