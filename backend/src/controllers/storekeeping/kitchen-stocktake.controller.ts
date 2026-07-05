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
 * every fixed item by inventory_item_id. Opening stock for a shift = the
 * closing stock of whichever shift immediately precedes it — Shift B's
 * opening is Shift A's closing on the SAME day, and Shift A's opening is the
 * previous day's last shift's closing. Shift letters sort A < B, so the
 * (date, shift) tuple comparison below captures both cases in one query.
 */
const getPreviousKitchenClosingByInvId = async (
  branchId: number,
  invIds: string[],
  stocktakeDate: string,
  shift: string
): Promise<Map<string, number>> => {
  if (invIds.length === 0) return new Map();
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (ki.inventory_item_id) ki.inventory_item_id, ki.closing_qty
       FROM public.kitchen_stocktake_items ki
       JOIN public.kitchen_stocktake_shifts ks ON ks.id = ki.shift_id
       WHERE ks.branch_id = $1
         AND ki.inventory_item_id = ANY($2)
         AND (ks.stocktake_date < $3 OR (ks.stocktake_date = $3 AND ks.shift < $4))
       ORDER BY ki.inventory_item_id, ks.stocktake_date DESC, ks.shift DESC`,
      [branchId, invIds, stocktakeDate, shift]
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
export const getApprovedKitchenSpoilageByName = async (
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

/**
 * POS menu item names almost never match the fixed kitchen stocktake catalog
 * exactly (e.g. POS "mbuzi wet fry 1/4 kg" vs stocktake "Mbuzi Wetfry", POS
 * "ndazi" vs stocktake "Mandazi") even though they're the same physical
 * dish, so a plain normalized-name match misses nearly everything. This maps
 * each POS menu name (lowercase, trimmed) to the stocktake item it
 * represents. Only confident, unambiguous matches are listed (verified
 * against this branch's real menu) — anything not listed is intentionally
 * left unmatched rather than guessed, so Sold never silently misattributes
 * one dish's sales to a different stock item.
 */
export const POS_NAME_TO_STOCKTAKE_ITEM: Record<string, string> = {
  'mbuzi wet fry 1/4 kg': 'Mbuzi Wetfry',
  'mbuzi wet fry 1/2 kg': 'Mbuzi Wetfry',
  'mbuzi choma 1/4 kg': 'Mbuzi Choma',
  'mbuzi choma 1/2 kg': 'Mbuzi Choma',
  'mbuzi choma 1 kg': 'Mbuzi Choma',
  '1/4 kg kuku kienyeji dry fry': 'Chicken K',
  '1/4 kg kuku kienyeji wet fry': 'Chicken K',
  '1/4 kg kuku kienyeji pan fry': 'Chicken K',
  '1/2 kg kuku kienyeji wet fry': 'Chicken K',
  '1/4 kg chicken dry fry': 'Chicken B',
  '1/4 kg chicken wet fry': 'Chicken B',
  '1/4 kg chicken pan fry': 'Chicken B',
  '1/2 kg chicken dry fry': 'Chicken B',
  '1/2 kg chicken pan fry': 'Chicken B',
  '1/2 kg chicken wet fry': 'Chicken B',
  '1 kg chicken dry fry': 'Chicken B',
  'special chicken': 'Chicken B',
  'sausage': 'Sausages',
  'special sausage': 'Sausages',
  'samosa': 'Samosa',
  'special samosa': 'Samosa',
  'chapati': 'Chapati',
  'fish dry whole': 'Fish',
  'fish wet whole': 'Fish',
  'rice plain': 'Rice',
  'special rice': 'Rice',
  'pilau': 'Pilau',
  'special pilau': 'Pilau',
  'beef wet fry 1/4 kg': 'Beef',
  'beef pan fry 1/4 kg': 'Beef',
  'beef stew 1/4 kg': 'Beef',
  'ndazi': 'Mandazi',
  'kebab': 'Kebab',
  'special kebab': 'Kebab',
  'mahamri': 'Mahamri',
  'chips': 'Chips',
  'chips masala': 'Chips',
  'boiled eggs broiler': 'Eggs B',
  'fried eggs broiler': 'Eggs B',
  'scrambled eggs broiler': 'Eggs B',
  'spanish omelette broiler': 'Eggs B',
  'boiled eggs kienyeji': 'Eggs K',
  'fried eggs kienyeji': 'Eggs K',
  'scrambled eggs kienyeji': 'Eggs K',
  'spanish omelette kienyeji': 'Eggs K',
  'kcc milk packet': 'Milk',
  'fresh milk glass': 'Milk',
};

/**
 * Sum real POS sales for each fixed kitchen item, scoped to whichever
 * portion of the day this shift is responsible for, so the same sale is
 * never counted against both shifts: Shift A claims sales up to its own
 * submission (or now, if still a draft); Shift B claims the rest of the day.
 *
 * Sales live in pos_shift_orders (JSONB items array) — restaurant_orders /
 * restaurant_order_items are unused/empty tables in this deployment, so a
 * query against them (the previous implementation) always returned zero
 * regardless of real sales activity.
 */
export const getKitchenSoldByName = async (
  branchId: number,
  itemNames: string[],
  stocktakeDate: string,
  shift: string
): Promise<Map<string, number>> => {
  if (itemNames.length === 0) return new Map();
  try {
    const { data: siblingShifts } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('shift, submitted_at')
      .eq('branch_id', branchId)
      .eq('stocktake_date', stocktakeDate)
      .in('shift', ['A', 'B']);
    const shiftARow = (siblingShifts || []).find((s: any) => s.shift === 'A');
    const shiftBRow = (siblingShifts || []).find((s: any) => s.shift === 'B');
    const dayStart = `${stocktakeDate}T00:00:00.000Z`;
    const now = new Date().toISOString();
    const from = shift === 'A' ? dayStart : (shiftARow?.submitted_at || dayStart);
    const to = shift === 'A' ? (shiftARow?.submitted_at || now) : (shiftBRow?.submitted_at || now);

    const { rows } = await db.query(
      `SELECT LOWER(TRIM(item->>'name')) AS item_name_norm,
              COALESCE(SUM((item->>'quantity')::numeric), 0) AS sold_qty
       FROM public.pos_shift_orders pso
       CROSS JOIN LATERAL jsonb_array_elements(pso.items) AS item
       WHERE pso.branch_id = $1
         AND pso.created_at >= $2 AND pso.created_at <= $3
         AND COALESCE(pso.status, '') != 'voided'
       GROUP BY LOWER(TRIM(item->>'name'))`,
      [branchId, from, to]
    );
    const byNormName = new Map<string, number>((rows || []).map((r: any) => [r.item_name_norm, num(r.sold_qty)]));
    return await mapPosSalesToStocktakeItems(byNormName, itemNames, branchId);
  } catch (err) {
    logger.warn('getKitchenSoldByName failed:', (err as Error).message);
    return new Map();
  }
};

// Ledger rows measured in RAW units (KG / Litre) — their "system sold" must
// be converted from menu portions into raw units via the set standard
// recipes, never counted 1:1.
const RAW_UNIT_ROWS = new Set([
  'Mbuzi Raw', 'Chicken K', 'Chicken B', 'Fish', 'Rice', 'Beef', 'Chips', 'Milk',
]);

/** Maps a standard recipe's RAW item to its ledger row (raw rows only). */
const resolveRawRow = (sku: string, name: string): string | null => {
  const s = String(sku || '').toUpperCase();
  const n = String(name || '').toUpperCase();
  if (s === 'FG-149' || n.includes('MBUZI')) return 'Mbuzi Raw';
  if (n.includes('KIENYEJI')) return 'Chicken K';
  if (s === 'FG-15' || n.includes('BROILER')) return 'Chicken B';
  if (s === 'FG-18' || n.includes('FISH')) return 'Fish';
  if (s === 'FG-5' || n === 'RICE') return 'Rice';
  if (s === 'FG-80' || s === 'BEEF-001' || n === 'BEEF') return 'Beef';
  if (s === 'FG-86' || n.includes('POTATO')) return 'Chips';
  if (s === 'FG-106' || s === 'MILK-001' || n === 'MILK') return 'Milk';
  return null;
};

/**
 * Converts the day's POS sales into ledger-item quantities.
 *
 * The SET STANDARD RECIPES (kitchen_production_recipes) are authoritative:
 * a sold "1/4 Kg Chicken Wet Fry" consumes 0.25 KG of BROILERS per the
 * standard, not 1 unit. Expected sales per the standards vs physical usage
 * is what makes the ledger variance meaningful (negative variance = shorts,
 * positive = surplus/under-recording). The static 1:1 name map below only
 * covers menu items that have NO standard recipe set (finished piece items
 * like Samosa/Chapati, or unmapped specials).
 */
// Weight factors for kg-named menu items whose ledger row is measured in KG:
// a "1/4 kg" serving moves 0.25 KG of that row's stock, never 1 unit. Applies
// to the name-map fallback only (standard recipes carry their own ratios).
const POS_NAME_QTY_FACTOR: Record<string, number> = {
  'mbuzi wet fry 1/4 kg': 0.25,
  'mbuzi wet fry 1/2 kg': 0.5,
  'mbuzi choma 1/4 kg': 0.25,
  'mbuzi choma 1/2 kg': 0.5,
  'mbuzi choma 1 kg': 1,
  '1/4 kg kuku kienyeji dry fry': 0.25,
  '1/4 kg kuku kienyeji wet fry': 0.25,
  '1/4 kg kuku kienyeji pan fry': 0.25,
  '1/2 kg kuku kienyeji wet fry': 0.5,
};

const mapPosSalesToStocktakeItems = async (
  byNormName: Map<string, number>,
  itemNames: string[],
  branchId: number
): Promise<Map<string, number>> => {
  const itemNameSet = new Set(itemNames);
  const map = new Map<string, number>();
  // Pair-level suppression: a standard recipe only replaces the 1:1 fallback
  // when both attribute the SAME menu item to the SAME ledger row. A parent
  // raw item (e.g. Mbuzi Raw ← "Mbuzi Wet Fry 1/4 Kg") and the cooked-pan row
  // (Mbuzi Wetfry ← same sale, weight-factored) are DIFFERENT physical
  // control levels, so the sale legitimately reconciles at both.
  const coveredPairs = new Set<string>();

  try {
    const { rows: rules } = await db.query(
      `SELECT raw_item_sku, raw_item_name, raw_quantity, produced_item_name, produced_quantity
         FROM kitchen_production_recipes
        WHERE branch_id = $1 AND is_active = true
          AND raw_quantity > 0 AND produced_quantity > 0`,
      [branchId]
    );
    for (const rule of rules || []) {
      const row = resolveRawRow(rule.raw_item_sku, rule.raw_item_name);
      if (!row || !RAW_UNIT_ROWS.has(row) || !itemNameSet.has(row)) continue;
      const producedNorm = String(rule.produced_item_name || '').trim().toLowerCase();
      // Covered even when nothing sold: the standard owns this pairing.
      coveredPairs.add(`${producedNorm}→${row}`);
      const sold = byNormName.get(producedNorm);
      if (!sold) continue;
      map.set(
        row,
        (map.get(row) || 0) + (sold / num(rule.produced_quantity)) * num(rule.raw_quantity)
      );
    }
  } catch (err) {
    logger.warn('Standard-recipe sold conversion failed; using 1:1 name map only:',
      (err as Error).message);
  }

  for (const [posName, stocktakeName] of Object.entries(POS_NAME_TO_STOCKTAKE_ITEM)) {
    if (!itemNameSet.has(stocktakeName)) continue;
    if (coveredPairs.has(`${posName}→${stocktakeName}`)) continue;
    const qty = byNormName.get(posName);
    if (qty == null) continue;
    const factor = POS_NAME_QTY_FACTOR[posName] ?? 1;
    map.set(stocktakeName, (map.get(stocktakeName) || 0) + qty * factor);
  }
  return map;
};

/**
 * Sum real POS sales for each fixed kitchen item across a plain calendar-day
 * window (not split by shift submission time). Shift submission timestamps
 * for this branch are frequently backfilled — both shifts submitted within
 * minutes of each other, often hours before the day's real sales even start
 * — so splitting by submitted_at (as getKitchenSoldByName does, for the
 * live per-shift Kitchen Stocktake screen) misses nearly all of a day's
 * sales. The Stock Ledger's full-day view doesn't need shift-level
 * splitting, so it uses the reliable calendar-day boundary instead.
 */
export const getKitchenSoldByNameForDay = async (
  branchId: number,
  itemNames: string[],
  stocktakeDate: string
): Promise<Map<string, number>> => {
  if (itemNames.length === 0) return new Map();
  try {
    const { rows } = await db.query(
      `SELECT LOWER(TRIM(item->>'name')) AS item_name_norm,
              COALESCE(SUM((item->>'quantity')::numeric), 0) AS sold_qty
       FROM public.pos_shift_orders pso
       CROSS JOIN LATERAL jsonb_array_elements(pso.items) AS item
       WHERE pso.branch_id = $1
         AND pso.created_at >= $2::date AND pso.created_at < ($2::date + INTERVAL '1 day')
         AND COALESCE(pso.status, '') != 'voided'
       GROUP BY LOWER(TRIM(item->>'name'))`,
      [branchId, stocktakeDate]
    );
    const byNormName = new Map<string, number>((rows || []).map((r: any) => [r.item_name_norm, num(r.sold_qty)]));
    return await mapPosSalesToStocktakeItems(byNormName, itemNames, branchId);
  } catch (err) {
    logger.warn('getKitchenSoldByNameForDay failed:', (err as Error).message);
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
  shift: string,
  status: string,
  items: Array<{ item_name: string; inventory_item_id?: string | null; opening_qty: number; added_qty: number; closing_qty: number; spoilage_qty?: number; sold_qty?: number }>
): Promise<void> => {
  // One stock_counts row PER SHIFT (location: kitchen_a, kitchen_b, ...) —
  // otherwise a same-day B-shift sync deletes and replaces A-shift's
  // stock_count_items under the same row, silently losing that shift's count
  // from the unified table every accountant/auditor actually reviews.
  const shiftLocation = `kitchen_${String(shift || '').toLowerCase()}`;
  const { data: existing } = await supabase
    .from('stock_counts')
    .select('id')
    .eq('branch_id', branchId)
    .eq('count_date', stocktakeDate)
    .eq('location', shiftLocation)
    .eq('store_type', 'kitchen')
    .maybeSingle();

  let stockCountId: string;
  const now = new Date().toISOString();
  const headerData = {
    branch_id: branchId,
    count_date: stocktakeDate,
    count_type: 'daily',
    store_type: 'kitchen',
    location: shiftLocation,
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
    // System-expected closing = what came in (opening + added) minus what
    // legitimately left (sold to customers, approved spoilage). Anything
    // left over after that is the real, unexplained variance — selling food
    // normally must not show up as a "shortage".
    const systemQty = num(it.opening_qty) + num(it.added_qty) - num(it.spoilage_qty) - num(it.sold_qty);
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
      explanation: (it as any).explanation || null,
      action_taken: (it as any).action_taken || null,
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
 * @desc    List submitted/reviewed kitchen stocktake shifts for the accountant
 *          review queue. Returns shifts with their item rows.
 * @route   GET /api/storekeeping/kitchen-stocktake/list?branch_id=&status=
 * @access  Branch Accountant, Branch Manager, Auditor, Super Admin
 */
export const listKitchenStocktakes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'branch_id is required' });
      return;
    }
    const statusFilter = req.query.status ? String(req.query.status) : null;
    let query = supabase
      .from('kitchen_stocktake_shifts')
      .select('*, items:kitchen_stocktake_items(*)')
      .eq('branch_id', branchId)
      .not('status', 'eq', 'draft')
      .order('stocktake_date', { ascending: false })
      .order('shift', { ascending: true });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    logger.error('listKitchenStocktakes failed:', error);
    next(error);
  }
};

/**
 * @desc    Accountant reviews a kitchen stocktake shift.
 * @route   PATCH /api/storekeeping/kitchen-stocktake/:id/review
 * @access  Branch Accountant, Super Admin
 */
export const reviewKitchenStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (fetchErr || !existing) {
      res.status(404).json({ success: false, message: 'Stocktake shift not found' });
      return;
    }
    if (existing.status !== 'submitted') {
      res.status(400).json({ success: false, message: `Cannot review a shift that is ${existing.status}` });
      return;
    }
    const { data, error } = await supabase
      .from('kitchen_stocktake_shifts')
      .update({ status: 'reviewed', reviewed_by: req.user?.id || null, reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('reviewKitchenStocktake failed:', error);
    next(error);
  }
};

/**
 * @desc    Accountant approves a kitchen stocktake shift. Re-syncs closing
 *          counts to pos_outlet_items so approval is the authoritative trigger.
 * @route   PATCH /api/storekeeping/kitchen-stocktake/:id/approve
 * @access  Branch Accountant, Super Admin
 */
export const approveKitchenStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('*, items:kitchen_stocktake_items(*)')
      .eq('id', req.params.id)
      .single();
    if (fetchErr || !existing) {
      res.status(404).json({ success: false, message: 'Stocktake shift not found' });
      return;
    }
    if (!['submitted', 'reviewed'].includes(existing.status)) {
      res.status(400).json({ success: false, message: `Cannot approve a shift that is ${existing.status}` });
      return;
    }

    // Validate that all items with non-zero variance have an explanation and action taken
    const branchId = existing.branch_id;
    const stocktakeDate = existing.stocktake_date;
    const shift = existing.shift;

    const [spoilageByName, soldByName] = await Promise.all([
      getApprovedKitchenSpoilageByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, shift),
      getKitchenSoldByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, shift),
    ]);

    const savedItems = (existing.items || []) as any[];
    const unexplained = savedItems.filter((it: any) => {
      const spoilage = spoilageByName.get(it.item_name) ?? 0;
      const sold = soldByName.get(it.item_name) ?? 0;
      const system = num(it.opening_qty) + num(it.added_qty) - spoilage - sold;
      const physical = num(it.closing_qty);
      const variance = physical - system;
      return variance !== 0 && (!it.explanation || !it.action_taken);
    });

    if (unexplained.length > 0) {
      res.status(400).json({
        success: false,
        message: `All kitchen item variances must have an explanation and action taken before approval. Missing for: ${unexplained.map(i => i.item_name).join(', ')}`,
      });
      return;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('kitchen_stocktake_shifts')
      .update({ status: 'approved', reviewed_by: req.user?.id || null, reviewed_at: existing.reviewed_at || now })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;

    // Re-apply closing counts to pos_outlet_items so approval is the
    // authoritative stock-update trigger (submit already does this too,
    // but approval confirms the accountant has verified the counts).
    if (savedItems.length > 0) {
      try {
        await db.query(
          `UPDATE public.pos_outlet_items poi
           SET current_stock = kti.closing_qty::numeric,
               updated_at    = NOW()
           FROM (VALUES ${savedItems.map((_: any, i: number) => `($${i * 2 + 1}::text, $${i * 2 + 2}::numeric)`).join(', ')})
                 AS kti(item_name, closing_qty)
           JOIN public.pos_outlets po ON po.branch_id = $${savedItems.length * 2 + 1}
                                     AND po.outlet_type = 'restaurant'
           WHERE poi.outlet_id = po.id
             AND LOWER(TRIM(poi.name)) = LOWER(TRIM(kti.item_name))`,
          [...savedItems.flatMap((it: any) => [it.item_name, num(it.closing_qty)]), existing.branch_id]
        );
      } catch (err) {
        logger.warn('approveKitchenStocktake: pos_outlet_items sync failed:', (err as Error).message);
      }
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('approveKitchenStocktake failed:', error);
    next(error);
  }
};

/**
 * @desc    Accountant updates explanation and action_taken for kitchen stocktake items.
 * @route   PUT /api/storekeeping/kitchen-stocktake/:id/items
 * @access  Branch Accountant, Super Admin
 */
export const updateKitchenStocktakeItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    const { data: existingShift, error: fetchErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existingShift) {
      res.status(404).json({ success: false, message: 'Stocktake shift not found' });
      return;
    }

    if (existingShift.status !== 'submitted' && existingShift.status !== 'reviewed') {
      res.status(400).json({ success: false, message: `Cannot update items when shift is in status ${existingShift.status}` });
      return;
    }

    const now = new Date().toISOString();

    for (const item of items) {
      const { error: itemErr } = await supabase
        .from('kitchen_stocktake_items')
        .update({
          explanation: item.explanation !== undefined ? item.explanation : null,
          action_taken: item.action_taken !== undefined ? item.action_taken : null,
          updated_at: now
        })
        .eq('shift_id', id)
        .eq('item_name', item.item_name);

      if (itemErr) {
        logger.warn(`Could not update kitchen_stocktake_items row for ${item.item_name}: ${itemErr.message}`);
      }
    }

    // Load updated shift items and sync to stock_counts
    const { data: updatedItems, error: itemsErr } = await supabase
      .from('kitchen_stocktake_items')
      .select('*')
      .eq('shift_id', id);

    if (itemsErr) throw itemsErr;

    const [spoilageByName, soldByName] = await Promise.all([
      getApprovedKitchenSpoilageByName(existingShift.branch_id, KITCHEN_STOCKTAKE_ITEMS, existingShift.stocktake_date, existingShift.shift),
      getKitchenSoldByName(existingShift.branch_id, KITCHEN_STOCKTAKE_ITEMS, existingShift.stocktake_date, existingShift.shift),
    ]);

    const itemsForSync = (updatedItems || []).map((it: any) => ({
      ...it,
      inventory_item_id: it.inventory_item_id || null,
      spoilage_qty: spoilageByName.get(it.item_name) ?? 0,
      sold_qty: soldByName.get(it.item_name) ?? 0,
      explanation: it.explanation || null,
      action_taken: it.action_taken || null,
    }));

    await syncKitchenStocktakeToStockCounts(
      existingShift.branch_id,
      existingShift.stocktake_date,
      existingShift.shift,
      existingShift.status,
      itemsForSync
    );

    res.status(200).json({ success: true, message: 'Kitchen stocktake items updated successfully' });
  } catch (error) {
    logger.error('updateKitchenStocktakeItems failed:', error);
    next(error);
  }
};

/**
 * @desc    Accountant rejects a kitchen stocktake shift.
 * @route   PATCH /api/storekeeping/kitchen-stocktake/:id/reject
 * @access  Branch Accountant, Super Admin
 */
export const rejectKitchenStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notes = String(req.body?.notes || '').trim();
    if (!notes) {
      res.status(400).json({ success: false, message: 'notes are required when rejecting' });
      return;
    }
    const { data: existing, error: fetchErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('id, status')
      .eq('id', req.params.id)
      .single();
    if (fetchErr || !existing) {
      res.status(404).json({ success: false, message: 'Stocktake shift not found' });
      return;
    }
    if (['approved', 'rejected'].includes(existing.status)) {
      res.status(400).json({ success: false, message: `Cannot reject a shift that is ${existing.status}` });
      return;
    }
    const { data, error } = await supabase
      .from('kitchen_stocktake_shifts')
      .update({ status: 'rejected', rejection_notes: notes, reviewed_by: req.user?.id || null, reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('rejectKitchenStocktake failed:', error);
    next(error);
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

    const [previousClosingByInvId, productionAddedByInvId, pastryAddedByInvId, spoilageByName, soldByName] = await Promise.all([
      getPreviousKitchenClosingByInvId(branchId, invIds, stocktakeDate, shift),
      getKitchenProductionAddedByInvId(branchId, invIds, stocktakeDate, shift),
      getPastryAddedByInvId(branchId, invIds, stocktakeDate),
      getApprovedKitchenSpoilageByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, shift),
      getKitchenSoldByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, shift),
    ]);

    const buildItem = (name: string, existing?: any): Record<string, any> => {
      const invId = kitchenItemMap.get(name);
      const spoilageQty = spoilageByName.get(name) ?? 0;
      const soldQty = soldByName.get(name) ?? 0;
      const opening = invId ? previousClosingByInvId.get(invId) ?? 0 : 0;
      const computedAdded = invId
        ? (productionAddedByInvId.get(invId) ?? 0) + (pastryAddedByInvId.get(invId) ?? 0)
        : 0;
      // added_qty is editable by the storekeeper (kitchen staff prepare extra
      // items that never go through the separate production-logging flow),
      // so once a draft row has been saved, its stored value wins over a
      // fresh system recompute — same precedence as closing_qty below.
      const added = existing?.added_qty != null ? num(existing.added_qty) : computedAdded;
      return {
        item_id: invId || null,
        item_name: name,
        opening_qty: opening,
        added_qty: added,
        sold_qty: soldQty,
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
          return { ...existing, spoilage_qty: spoilageByName.get(name) ?? 0, sold_qty: soldByName.get(name) ?? 0 };
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

    const [previousClosingByInvId, productionAddedByInvId, pastryAddedByInvId, spoilageByName, soldByName] = await Promise.all([
      getPreviousKitchenClosingByInvId(branchId, invIds, stocktakeDate, shift),
      getKitchenProductionAddedByInvId(branchId, invIds, stocktakeDate, shift),
      getPastryAddedByInvId(branchId, invIds, stocktakeDate),
      getApprovedKitchenSpoilageByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, shift),
      getKitchenSoldByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, shift),
    ]);

    const itemRows = KITCHEN_STOCKTAKE_ITEMS.map((name) => {
      const invId = kitchenItemMap.get(name);
      // Accept either item_id (unified) or item_name (legacy) from the client.
      const submitted = items.find(
        (it: any) => (it.item_id && invId && it.item_id === invId) || it.item_name === name
      );
      const closing = num(submitted?.closing_qty);
      const opening = invId ? previousClosingByInvId.get(invId) ?? 0 : 0;
      const computedAdded = invId
        ? (productionAddedByInvId.get(invId) ?? 0) + (pastryAddedByInvId.get(invId) ?? 0)
        : 0;
      // added_qty is storekeeper-editable: if the client sends a value, it
      // overrides the system-computed production/pastry total (kitchen
      // staff often prepare extras that never get logged as a separate
      // production session). Falls back to the computed total when omitted
      // so older app builds that don't send added_qty keep working.
      const added = submitted?.added_qty != null ? num(submitted.added_qty) : computedAdded;
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
    // spoilage_qty/sold_qty aren't stored on kitchen_stocktake_items — they're
    // computed fresh each time, same as on the GET side — so merge them in
    // here for both the variance sync and the response the storekeeper sees.
    const itemsForSync = (savedItems || itemRows).map((it: any) => ({
      ...it,
      inventory_item_id: it.inventory_item_id || null,
      spoilage_qty: spoilageByName.get(it.item_name) ?? 0,
      sold_qty: soldByName.get(it.item_name) ?? 0,
    }));
    await syncKitchenStocktakeToStockCounts(branchId, stocktakeDate, shiftRow.shift, shiftRow.status, itemsForSync);

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
      data: { ...shiftRow, items: itemsForSync },
    });
  } catch (error) {
    logger.error('saveKitchenStocktake failed:', error);
    next(error);
  }
};
