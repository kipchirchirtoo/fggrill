import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import db from '../../db';
import { logger } from '../../utils/logger';
import { isGlobalRole } from '../../utils/branchIsolation';

// Kitchen Stocktake — replicates the physical paper logbook used at the
// kitchen serving counter: OPEN / ADD / CLOSING / VAR per item, two shifts
// (A/B) per day. Item list is a fixed catalog (see KITCHEN_STOCKTAKE_ITEMS)
// since these are prepared dishes, not raw branch_stock ingredients.
//
// Each fixed item is now linked to a single inventory_items row via
// inventory_item_id so the kitchen stocktake talks to the same item registry
// as kitchen production, pastry production, and the unified stock_counts gate.

export const KITCHEN_STOCKTAKE_ITEMS = [
  'Mbuzi Wetfry',
  'Mbuzi Choma',
  'Mbuzi Raw',
  'Chicken K',
  'Chicken B',
  'Sausages',
  'Samosa',
  'Chapati',
  'Fish',
  'Rice',
  'Pilau',
  'Beef',
  'Mandazi',
  'Kebab',
  'Mahamri',
  'Chips',
  'Eggs B',
  'Eggs K',
  'Milk',
];

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const slugSku = (name: string): string => {
  return 'KITCHEN-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
};

/**
 * Ensure every fixed kitchen stocktake item has a matching inventory_items row.
 * Returns a map of item_name -> inventory_item_id.
 */
const ensureKitchenInventoryItems = async (): Promise<Map<string, string>> => {
  const { data: existing } = await supabase
    .from('inventory_items')
    .select('id, item_name')
    .in('item_name', KITCHEN_STOCKTAKE_ITEMS);

  const map = new Map<string, string>();
  const missing: string[] = [];
  for (const name of KITCHEN_STOCKTAKE_ITEMS) {
    const found = (existing || []).find((i: any) => i.item_name === name);
    if (found) map.set(name, found.id);
    else missing.push(name);
  }

  if (missing.length > 0) {
    const rows = missing.map((name) => ({
      item_name: name,
      sku: slugSku(name),
      unit: 'portion',
      category: 'KITCHEN MENU',
      item_type: 'stockable',
      is_active: true,
      default_unit_cost: 0,
      default_selling_price: 0,
    }));
    const { data: created } = await supabase
      .from('inventory_items')
      .insert(rows)
      .select('id, item_name');
    for (const c of (created || [])) map.set(c.item_name, c.id);
  }

  return map;
};

/**
 * Bulk-fetch the most recent previous kitchen stocktake closing quantity for
 * every fixed item by inventory_item_id. Opening stock for today's count =
 * yesterday's (or last recorded) closing stock.
 */
const getPreviousKitchenClosingByInvId = async (
  branchId: number,
  invIds: string[],
  stocktakeDate: string
): Promise<Map<string, number>> => {
  if (invIds.length === 0) return new Map();
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (ki.inventory_item_id) ki.inventory_item_id, ki.closing_qty
       FROM public.kitchen_stocktake_items ki
       JOIN public.kitchen_stocktake_shifts ks ON ks.id = ki.shift_id
       WHERE ks.branch_id = $1
         AND ks.stocktake_date < $2
         AND ki.inventory_item_id = ANY($3)
       ORDER BY ki.inventory_item_id, ks.stocktake_date DESC, ks.shift DESC`,
      [branchId, stocktakeDate, invIds]
    );
    return new Map((rows || []).map((r: any) => [r.inventory_item_id, num(r.closing_qty)]));
  } catch (err) {
    logger.warn('getPreviousKitchenClosingByInvId failed:', (err as Error).message);
    return new Map();
  }
};

/**
 * Bulk-sum the actual production output for every fixed prepared dish on a
 * given date/shift. This is the "added" quantity in the kitchen stocktake.
 */
const getKitchenProductionAddedByInvId = async (
  branchId: number,
  invIds: string[],
  stocktakeDate: string,
  shift: string
): Promise<Map<string, number>> => {
  const shiftType = shift === 'A' ? 'shift_a' : 'shift_b';
  if (invIds.length === 0) return new Map();
  try {
    const { rows } = await db.query(
      `SELECT kpe.inventory_item_id,
              COALESCE(SUM(kpe.actual_quantity), 0) AS added_qty
       FROM public.kitchen_production_entries kpe
       JOIN public.kitchen_production_sessions kps ON kps.id = kpe.session_id
       WHERE kps.branch_id = $1
         AND kps.session_date = $2
         AND kps.shift_type = $3
         AND kpe.inventory_item_id = ANY($4)
       GROUP BY kpe.inventory_item_id`,
      [branchId, stocktakeDate, shiftType, invIds]
    );
    return new Map((rows || []).map((r: any) => [r.inventory_item_id, num(r.added_qty)]));
  } catch (err) {
    logger.warn('getKitchenProductionAddedByInvId failed:', (err as Error).message);
    return new Map();
  }
};

/**
 * Sum pastry items that were produced and issued to the kitchen on the given date.
 * These count as "added" quantity for the kitchen stocktake.
 */
const getPastryAddedByInvId = async (
  branchId: number,
  invIds: string[],
  stocktakeDate: string
): Promise<Map<string, number>> => {
  if (invIds.length === 0) return new Map();
  try {
    const { rows } = await db.query(
      `SELECT ppl.item_id AS inventory_item_id,
              COALESCE(SUM(ppl.issued_quantity), 0) AS added_qty
       FROM public.pastry_production_log ppl
       WHERE ppl.branch_id = $1
         AND ppl.issued_to_kitchen = true
         AND ppl.issued_at::date = $2
         AND ppl.item_id = ANY($3)
       GROUP BY ppl.item_id`,
      [branchId, stocktakeDate, invIds]
    );
    return new Map((rows || []).map((r: any) => [r.inventory_item_id, num(r.added_qty)]));
  } catch (err) {
    logger.warn('getPastryAddedByInvId failed:', (err as Error).message);
    return new Map();
  }
};

/**
 * Bulk-fetch approved spoilage quantities for every fixed item, for a given
 * branch/date/shift. Subtracted from the expected (system) quantity so the
 * displayed variance reflects unexplained loss only — spoilage that the
 * accountant already approved is "explained" and shouldn't show as variance.
 */
const getApprovedKitchenSpoilageByName = async (
  branchId: number,
  itemNames: string[],
  stocktakeDate: string,
  shift: string
): Promise<Map<string, number>> => {
  try {
    const { data, error } = await supabase
      .from('branch_spoilage_log')
      .select('item_name, quantity')
      .eq('branch_id', branchId)
      .eq('area', 'kitchen')
      .eq('status', 'approved')
      .eq('spoilage_date', stocktakeDate)
      .eq('shift', shift)
      .in('item_name', itemNames);
    if (error) throw error;
    const map = new Map<string, number>();
    for (const row of (data || []) as any[]) {
      map.set(row.item_name, (map.get(row.item_name) || 0) + num(row.quantity));
    }
    return map;
  } catch (err) {
    logger.warn('getApprovedKitchenSpoilageByName failed:', (err as Error).message);
    return new Map();
  }
};

const resolveBranchId = (req: Request): number | null => {
  let branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
  if (!isGlobalRole(req.user?.role)) {
    branchId = req.user?.branch_id;
  }
  return Number.isInteger(branchId) ? (branchId as number) : null;
};

/**
 * Sync the kitchen stocktake shift for a branch/date into the unified
 * stock_counts / stock_count_items tables. This is the canonical source used
 * by the cashier shift opening gate (location = 'kitchen').
 */
const syncKitchenStocktakeToStockCounts = async (
  branchId: number,
  stocktakeDate: string,
  status: string,
  items: Array<{ item_name: string; inventory_item_id?: string | null; opening_qty: number; added_qty: number; closing_qty: number; spoilage_qty?: number }>
): Promise<void> => {
  const { data: existing } = await supabase
    .from('stock_counts')
    .select('id')
    .eq('branch_id', branchId)
    .eq('count_date', stocktakeDate)
    .eq('location', 'kitchen')
    .eq('store_type', 'kitchen')
    .maybeSingle();

  let stockCountId: string;
  const now = new Date().toISOString();
  const headerData = {
    branch_id: branchId,
    count_date: stocktakeDate,
    count_type: 'daily',
    store_type: 'kitchen',
    location: 'kitchen',
    status,
  };

  if (existing?.id) {
    stockCountId = existing.id;
    const { error } = await supabase
      .from('stock_counts')
      .update({ ...headerData, updated_at: now })
      .eq('id', stockCountId);
    if (error) throw error;
  } else {
    const { data: created, error } = await supabase
      .from('stock_counts')
      .insert({ ...headerData, created_at: now, updated_at: now })
      .select('id')
      .single();
    if (error) throw error;
    stockCountId = created!.id;
  }

  // Delete existing items so we can re-insert the latest set
  await supabase.from('stock_count_items').delete().eq('stock_count_id', stockCountId);

  const itemRows = items.map((it) => {
    const systemQty = num(it.opening_qty) + num(it.added_qty) - num(it.spoilage_qty);
    const physicalQty = num(it.closing_qty);
    return {
      stock_count_id: stockCountId,
      item_id: it.inventory_item_id || null,
      item_sku: it.item_name,
      system_quantity: systemQty,
      physical_quantity: physicalQty,
      counted_quantity: physicalQty,
      variance: physicalQty - systemQty,
      status,
      created_at: now,
      updated_at: now,
    };
  });

  if (itemRows.length > 0) {
    const { error } = await supabase.from('stock_count_items').insert(itemRows);
    if (error) throw error;
  }
};

/**
 * @desc    Get the kitchen stocktake for a branch/date/shift. If no shift
 *          row exists yet, returns a draft scaffold pre-filled with the
 *          fixed 19-item catalog at zero counts.
 * @route   GET /api/storekeeping/kitchen-stocktake?branch_id=&date=&shift=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const getKitchenStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'branch_id is required' });
      return;
    }
    const shift = String(req.query.shift || 'A').toUpperCase();
    if (!['A', 'B'].includes(shift)) {
      res.status(400).json({ success: false, message: "shift must be 'A' or 'B'" });
      return;
    }
    const stocktakeDate = String(req.query.date || new Date().toISOString().split('T')[0]);

    const { data: shiftRow, error: shiftErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('*, items:kitchen_stocktake_items(*)')
      .eq('branch_id', branchId)
      .eq('stocktake_date', stocktakeDate)
      .eq('shift', shift)
      .maybeSingle();
    if (shiftErr) throw shiftErr;

    const kitchenItemMap = await ensureKitchenInventoryItems();
    const invIds = Array.from(kitchenItemMap.values());

    const [previousClosingByInvId, productionAddedByInvId, pastryAddedByInvId, spoilageByName] = await Promise.all([
      getPreviousKitchenClosingByInvId(branchId, invIds, stocktakeDate),
      getKitchenProductionAddedByInvId(branchId, invIds, stocktakeDate, shift),
      getPastryAddedByInvId(branchId, invIds, stocktakeDate),
      getApprovedKitchenSpoilageByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, shift),
    ]);

    const buildItem = (name: string, existing?: any): Record<string, any> => {
      const invId = kitchenItemMap.get(name);
      const spoilageQty = spoilageByName.get(name) ?? 0;
      const opening = invId ? previousClosingByInvId.get(invId) ?? 0 : 0;
      const added = invId
        ? (productionAddedByInvId.get(invId) ?? 0) + (pastryAddedByInvId.get(invId) ?? 0)
        : 0;
      return {
        item_id: invId || null,
        item_name: name,
        opening_qty: opening,
        added_qty: added,
        closing_qty: num(existing?.closing_qty),
        spoilage_qty: spoilageQty,
        variance: 0,
      };
    };

    const submitted = shiftRow?.status === 'submitted';
    if (shiftRow) {
      const itemsByName = new Map((shiftRow.items || []).map((i: any) => [i.item_name, i]));
      const items = KITCHEN_STOCKTAKE_ITEMS.map((name) => {
        const existing: any = itemsByName.get(name);
        if (submitted && existing) {
          return { ...existing, spoilage_qty: spoilageByName.get(name) ?? 0 };
        }
        return buildItem(name, existing);
      });
      res.status(200).json({
        success: true,
        data: { ...shiftRow, items },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        branch_id: branchId,
        stocktake_date: stocktakeDate,
        shift,
        dispenser_name: null,
        cheps_on_duty: [],
        confirmation_name: null,
        status: 'draft',
        items: KITCHEN_STOCKTAKE_ITEMS.map((name) => buildItem(name)),
      },
    });
  } catch (error) {
    logger.error('getKitchenStocktake failed:', error);
    next(error);
  }
};

/**
 * @desc    Save (and optionally submit) a kitchen stocktake for a branch/date/shift.
 *          The storekeeper only supplies the closing quantity. Opening is taken
 *          from the previous stocktake's closing and added is taken from the
 *          kitchen production output for the date/shift.
 * @route   POST /api/storekeeping/kitchen-stocktake
 *          body: { branch_id, stocktake_date, shift, dispenser_name?, cheps_on_duty?,
 *                  confirmation_name?, submit?: boolean,
 *                  items: [{ item_name, closing_qty }] }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const saveKitchenStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = resolveBranchId(req) || parseInt(req.body?.branch_id);
    if (!Number.isInteger(branchId)) {
      res.status(400).json({ success: false, message: 'branch_id is required' });
      return;
    }
    const shift = String(req.body?.shift || '').toUpperCase();
    if (!['A', 'B'].includes(shift)) {
      res.status(400).json({ success: false, message: "shift must be 'A' or 'B'" });
      return;
    }
    const stocktakeDate = req.body?.stocktake_date || new Date().toISOString().split('T')[0];
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const submit = Boolean(req.body?.submit);
    const chepsOnDuty = Array.isArray(req.body?.cheps_on_duty)
      ? req.body.cheps_on_duty.filter((n: any) => String(n || '').trim()).slice(0, 5)
      : [];

    const shiftPayload: Record<string, any> = {
      branch_id: branchId,
      stocktake_date: stocktakeDate,
      shift,
      dispenser_name: req.body?.dispenser_name ?? null,
      cheps_on_duty: chepsOnDuty,
      confirmation_name: req.body?.confirmation_name ?? null,
      updated_at: new Date().toISOString(),
    };
    if (submit) {
      shiftPayload.status = 'submitted';
      shiftPayload.submitted_by = req.user?.id || null;
      shiftPayload.submitted_at = new Date().toISOString();
    }

    const { data: shiftRow, error: shiftErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .upsert(shiftPayload, { onConflict: 'branch_id,stocktake_date,shift' })
      .select('*')
      .single();
    if (shiftErr) throw shiftErr;

    const kitchenItemMap = await ensureKitchenInventoryItems();
    const invIds = Array.from(kitchenItemMap.values());

    const [previousClosingByInvId, productionAddedByInvId, pastryAddedByInvId, spoilageByName] = await Promise.all([
      getPreviousKitchenClosingByInvId(branchId, invIds, stocktakeDate),
      getKitchenProductionAddedByInvId(branchId, invIds, stocktakeDate, shift),
      getPastryAddedByInvId(branchId, invIds, stocktakeDate),
      getApprovedKitchenSpoilageByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, shift),
    ]);

    const itemRows = KITCHEN_STOCKTAKE_ITEMS.map((name) => {
      const invId = kitchenItemMap.get(name);
      // Accept either item_id (unified) or item_name (legacy) from the client.
      const submitted = items.find(
        (it: any) => (it.item_id && invId && it.item_id === invId) || it.item_name === name
      );
      const closing = num(submitted?.closing_qty);
      const opening = invId ? previousClosingByInvId.get(invId) ?? 0 : 0;
      const added = invId
        ? (productionAddedByInvId.get(invId) ?? 0) + (pastryAddedByInvId.get(invId) ?? 0)
        : 0;
      return {
        shift_id: shiftRow.id,
        item_name: name,
        inventory_item_id: invId || null,
        opening_qty: opening,
        added_qty: added,
        closing_qty: closing,
        updated_at: new Date().toISOString(),
      };
    });

    const { data: savedItems, error: itemsErr } = await supabase
      .from('kitchen_stocktake_items')
      .upsert(itemRows, { onConflict: 'shift_id,item_name' })
      .select('*');
    if (itemsErr) throw itemsErr;

    // Sync into the unified stock_counts table so the cashier shift gate works.
    const itemsForSync = (savedItems || itemRows).map((it: any) => ({
      ...it,
      inventory_item_id: it.inventory_item_id || null,
      spoilage_qty: spoilageByName.get(it.item_name) ?? 0,
    }));
    await syncKitchenStocktakeToStockCounts(branchId, stocktakeDate, shiftRow.status, itemsForSync);

    // Closing count = reconciled kitchen portion count → write into the
    // restaurant POS outlet so waiters see the actual available stock.
    // Match pos_outlet_items to kitchen items by name (case-insensitive).
    if (savedItems && savedItems.length > 0) {
      try {
        await db.query(
          `UPDATE public.pos_outlet_items poi
           SET current_stock = kti.closing_qty::numeric,
               updated_at    = NOW()
           FROM (VALUES ${savedItems.map((_: any, i: number) => `($${i * 2 + 1}::text, $${i * 2 + 2}::numeric)`).join(', ')})
                AS kti(item_name, closing_qty)
           JOIN public.pos_outlets po
             ON po.branch_id  = $${savedItems.length * 2 + 1}
            AND po.outlet_type = 'restaurant'
           WHERE poi.outlet_id = po.id
             AND LOWER(TRIM(poi.name)) = LOWER(TRIM(kti.item_name))`,
          [
            ...savedItems.flatMap((it: any) => [it.item_name, num(it.closing_qty)]),
            branchId,
          ]
        );
      } catch (err) {
        logger.warn('kitchen stocktake: failed to sync closing counts to restaurant pos_outlet_items:', (err as Error).message);
      }
    }

    res.status(200).json({
      success: true,
      data: { ...shiftRow, items: savedItems },
    });
  } catch (error) {
    logger.error('saveKitchenStocktake failed:', error);
    next(error);
  }
};
