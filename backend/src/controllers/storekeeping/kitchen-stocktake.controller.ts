import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import db from '../../db';
import { InventoryStocktakePostingService } from '../../modules/inventory';
import { logger } from '../../utils/logger';
import { isGlobalRole } from '../../utils/branchIsolation';
import { getActiveShiftMode } from '../../services/shiftConfigService';

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

const withKitchenPostingFields = (record: any) => ({
  ...record,
  document_id: record.document_id ?? null,
  document_number: record.document_number ?? null,
  posted_at: record.posted_at ?? null,
  posting_status: record.posting_status ?? null,
  reversal_of_document_id: record.reversal_of_document_id ?? null,
});

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
         AND ks.status = 'approved'
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

type StocktakeContextRow = {
  item_id: string | null;
  item_name: string;
  opening_qty: number;
  added_qty: number;
  sold_qty: number;
  spoilage_qty: number;
  closing_qty: number;
  variance: number;
  explanation: string | null;
  action_taken: string | null;
  unit: string | null;
  category: string | null;
  item_type: string;
  channel: string | null;
  item_sku: string | null;
  expected_qty: number;
  system_qty: number;
};

type StandardsCatalogRow = {
  item_id: string | null;
  item_name: string;
  item_sku: string | null;
  unit: string | null;
  category: string | null;
  standard_type: 'RECIPE_STANDARD' | 'CHANNEL_STANDARD';
  default_channel: string | null;
};

type ChannelStandardRow = {
  channel: string;
  raw_item_sku: string | null;
  raw_item_name: string | null;
  quantity_per_pax: number;
  event_id: string | null;
  package_definition_id: string | null;
  package_name: string | null;
};

type StaffSummary = {
  user_id: string;
  name: string;
  role: string | null;
  department: string | null;
};

const toShiftLetter = (value: any): 'A' | 'B' => {
  const raw = String(value || 'A').trim().toUpperCase();
  return raw === 'B' ? 'B' : 'A';
};

const normalizeName = (value: any): string =>
  String(value || '').trim().toLowerCase();

const normalizeCode = (value: any): string =>
  String(value || '').trim().toUpperCase();

const titleCaseWords = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const buildKitchenShiftLabel = (
  shiftMode: 'SINGLE_SHIFT' | 'TWO_SHIFT' | null,
  shiftLetter: 'A' | 'B'
): string => (shiftMode === 'SINGLE_SHIFT' ? 'Single Shift' : `Shift ${shiftLetter}`);

const inferStocktakeType = (
  shiftMode: 'SINGLE_SHIFT' | 'TWO_SHIFT' | null,
  kitchenShift: any | null,
  shiftLetter: 'A' | 'B'
): string => {
  if (!kitchenShift) {
    return shiftMode === 'SINGLE_SHIFT'
      ? 'opening_single_shift'
      : shiftLetter === 'B'
          ? 'shift_b_unavailable'
          : 'opening_shift_a';
  }
  if (shiftMode === 'SINGLE_SHIFT') return 'single_shift_stocktake';
  if (shiftLetter === 'A') {
    return kitchenShift.status === 'open' ? 'shift_a_active' : 'shift_a_handover';
  }
  return 'shift_b_active';
};

const buildStandardMatchKeys = (entry: {
  item_id?: string | null;
  item_sku?: string | null;
  item_name?: string | null;
}): string[] => {
  const keys = new Set<string>();
  if (entry.item_id) keys.add(`id:${String(entry.item_id)}`);
  if (entry.item_sku) keys.add(`sku:${normalizeCode(entry.item_sku)}`);
  if (entry.item_name) keys.add(`name:${normalizeName(entry.item_name)}`);
  return [...keys].filter((key) => !key.endsWith(':'));
};

const buildInventoryOrFilter = (
  ids: string[],
  skus: string[],
  names: string[]
): string | null => {
  const parts: string[] = [];
  if (ids.length) {
    parts.push(`id.in.(${ids.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(',')})`);
  }
  if (skus.length) {
    parts.push(`sku.in.(${skus.map((sku) => `"${String(sku).replace(/"/g, '\\"')}"`).join(',')})`);
  }
  if (names.length) {
    parts.push(`item_name.in.(${names.map((name) => `"${String(name).replace(/"/g, '\\"')}"`).join(',')})`);
  }
  return parts.length ? parts.join(',') : null;
};

const includesKitchenStocktake = (location: string | null | undefined): boolean => {
  const normalized = String(location || 'KITCHEN').trim().toUpperCase();
  return normalized === 'KITCHEN' || normalized === 'BOTH';
};

const includesRawSide = (mode: string | null | undefined): boolean => {
  const normalized = String(mode || 'BOTH').trim().toUpperCase();
  return normalized === 'RAW_ONLY' || normalized === 'BOTH';
};

const includesProducedSide = (mode: string | null | undefined): boolean => {
  const normalized = String(mode || 'BOTH').trim().toUpperCase();
  return normalized === 'PRODUCED_ONLY' || normalized === 'BOTH';
};

const formatStandardChannel = (
  channel: string | null,
  standardType: StandardsCatalogRow['standard_type']
): string | null => {
  if (channel) return titleCaseWords(channel);
  if (standardType === 'RECIPE_STANDARD') {
    return 'POS Restaurant';
  }
  return null;
};

const getStandardTypePriority = (type: StandardsCatalogRow['standard_type']): number => {
  switch (type) {
    case 'CHANNEL_STANDARD':
      return 3;
    case 'RECIPE_STANDARD':
      return 2;
    default:
      return 0;
  }
};

const getStandardTypeRank = (type: string): number => {
  switch (String(type || '')) {
    case 'TRUE_BATCH_PRODUCTION_OUTPUT':
      return 4;
    case 'PRODUCTION_RAW_INPUT':
      return 3;
    case 'RECIPE_STANDARD':
      return 2;
    case 'CHANNEL_STANDARD':
      return 2;
    default:
      return 0;
  }
};

const fetchKitchenStandardsCatalog = async (
  branchId: number
): Promise<{
  entries: StandardsCatalogRow[];
  matchIndex: Map<string, StandardsCatalogRow>;
}> => {
  const [
    { data: recipeRows, error: recipeErr },
    { data: recipeInputs, error: recipeInputsErr },
    { data: channelStandards, error: standardsErr },
    { data: foodstuffRows, error: foodstuffsErr },
  ] = await Promise.all([
    supabase
      .from('kitchen_production_recipes')
      .select('raw_item_sku, raw_item_name, raw_unit, produced_item_sku, produced_item_name, produced_unit, stocktake_control_mode, stocktake_location')
      .eq('branch_id', branchId)
      .eq('is_active', true),
    supabase
      .from('kitchen_production_recipe_inputs')
      .select('raw_item_sku, raw_item_name, unit, recipe:kitchen_production_recipes!inner(branch_id, is_active, stocktake_control_mode, stocktake_location)')
      .eq('recipe.branch_id', branchId)
      .eq('recipe.is_active', true),
    supabase
      .from('channel_food_standards')
      .select('channel, raw_item_sku, raw_item_name, unit')
      .eq('branch_id', branchId),
    supabase
      .from('inventory_items')
      .select('id, sku, item_name, unit, category')
      .or('store_type.eq.foodstuffs,category.ilike.%food%,category.ilike.%produce%,category.ilike.%meat%,category.ilike.%poultry%,category.ilike.%vegetable%,category.ilike.%dairy%')
      .eq('is_active', true)
      .or(`branch_id.is.null,branch_id.eq.${branchId}`),
  ]);
  if (recipeErr) throw recipeErr;
  if (recipeInputsErr) throw recipeInputsErr;
  if (standardsErr) throw standardsErr;
  if (foodstuffsErr) logger.warn('Kitchen stocktake foodstuffs query warning:', foodstuffsErr.message);

  const rawEntries: StandardsCatalogRow[] = [];
  for (const row of (recipeRows || []) as any[]) {
    // COMPLEX recipes (raw_item_sku='MULTI') have multiple inputs stored in
    // kitchen_production_recipe_inputs — each is added individually below.
    const isMultiInput = String(row.raw_item_sku || '').trim().toUpperCase() === 'MULTI';
    if (!isMultiInput && includesKitchenStocktake(row.stocktake_location) && includesRawSide(row.stocktake_control_mode)) {
      rawEntries.push({
        item_id: null,
        item_name: String(row.raw_item_name || '').trim(),
        item_sku: row.raw_item_sku || null,
        unit: row.raw_unit || null,
        category: null,
        standard_type: 'RECIPE_STANDARD',
        default_channel: formatStandardChannel(null, 'RECIPE_STANDARD'),
      });
    }
    if (includesKitchenStocktake(row.stocktake_location) &&
        includesProducedSide(row.stocktake_control_mode) &&
        row.produced_item_name) {
      rawEntries.push({
        item_id: null,
        item_name: String(row.produced_item_name || '').trim(),
        item_sku: row.produced_item_sku || null,
        unit: row.produced_unit || null,
        category: null,
        standard_type: 'RECIPE_STANDARD',
        default_channel: formatStandardChannel(null, 'RECIPE_STANDARD'),
      });
    }
  }
  for (const row of (recipeInputs || []) as any[]) {
    const recipe = row.recipe || {};
    if (!includesKitchenStocktake(recipe.stocktake_location) ||
        !includesRawSide(recipe.stocktake_control_mode)) {
      continue;
    }
    rawEntries.push({
      item_id: null,
      item_name: String(row.raw_item_name || '').trim(),
      item_sku: row.raw_item_sku || null,
      unit: row.unit || null,
      category: null,
      standard_type: 'RECIPE_STANDARD',
      default_channel: formatStandardChannel(null, 'RECIPE_STANDARD'),
    });
  }
  for (const row of (channelStandards || []) as any[]) {
    rawEntries.push({
      item_id: null,
      item_name: String(row.raw_item_name || '').trim(),
      item_sku: row.raw_item_sku || null,
      unit: row.unit || null,
      category: null,
      standard_type: 'CHANNEL_STANDARD',
      default_channel: formatStandardChannel(String(row.channel || ''), 'CHANNEL_STANDARD'),
    });
  }
  for (const row of ((foodstuffRows || []) as any[])) {
    rawEntries.push({
      item_id: row.id || null,
      item_name: String(row.item_name || '').trim(),
      item_sku: row.sku || null,
      unit: row.unit || null,
      category: row.category || 'Foodstuffs',
      standard_type: 'RECIPE_STANDARD',
      default_channel: 'Kitchen Store',
    });
  }

  const candidateIds = [...new Set(rawEntries.map((entry) => String(entry.item_sku || '')).filter((value) => /^[0-9a-fA-F-]{36}$/.test(value)))];
  const candidateSkus = [...new Set(rawEntries.map((entry) => normalizeCode(entry.item_sku)).filter(Boolean))];
  const candidateNames = [...new Set(rawEntries.map((entry) => String(entry.item_name || '').trim()).filter(Boolean))];
  const inventoryFilter = buildInventoryOrFilter(candidateIds, candidateSkus, candidateNames);

  const inventoryRows = inventoryFilter
    ? await supabase
        .from('inventory_items')
        .select('id, sku, item_name, unit, category')
        .or(inventoryFilter)
    : { data: [], error: null } as any;
  if (inventoryRows.error) throw inventoryRows.error;

  const inventoryById = new Map<string, any>();
  const inventoryBySku = new Map<string, any>();
  const inventoryByName = new Map<string, any>();
  for (const row of (inventoryRows.data || []) as any[]) {
    if (row.id) inventoryById.set(String(row.id), row);
    if (row.sku) inventoryBySku.set(normalizeCode(row.sku), row);
    if (row.item_name) inventoryByName.set(normalizeName(row.item_name), row);
  }

  const dedupedByName = new Map<string, StandardsCatalogRow>();
  for (const entry of rawEntries) {
    if (!entry.item_name) continue;
    const inv =
      (entry.item_sku && inventoryById.get(String(entry.item_sku))) ||
      (entry.item_sku && inventoryBySku.get(normalizeCode(entry.item_sku))) ||
      inventoryByName.get(normalizeName(entry.item_name)) ||
      null;
    const hydrated: StandardsCatalogRow = {
      ...entry,
      item_id: inv?.id || entry.item_id || null,
      item_sku: inv?.sku || entry.item_sku || null,
      item_name: inv?.item_name || entry.item_name,
      unit: entry.unit || inv?.unit || null,
      category: inv?.category || entry.category || null,
      default_channel: entry.default_channel,
    };
    const key = normalizeName(hydrated.item_name);
    const existing = dedupedByName.get(key);
    if (!existing || getStandardTypePriority(hydrated.standard_type) > getStandardTypePriority(existing.standard_type)) {
      dedupedByName.set(key, hydrated);
    }
  }

  const entries = [...dedupedByName.values()].sort((a, b) => a.item_name.localeCompare(b.item_name));
  const matchIndex = new Map<string, StandardsCatalogRow>();
  for (const entry of entries) {
    for (const key of buildStandardMatchKeys(entry)) {
      if (!matchIndex.has(key)) matchIndex.set(key, entry);
    }
  }

  return { entries, matchIndex };
};

const resolveStandardEntry = (
  matchIndex: Map<string, StandardsCatalogRow>,
  value: { item_id?: string | null; item_sku?: string | null; item_name?: string | null }
): StandardsCatalogRow | null => {
  for (const key of buildStandardMatchKeys(value)) {
    const match = matchIndex.get(key);
    if (match) return match;
  }
  return null;
};

const getStaffSummaries = async (userIds: string[]): Promise<StaffSummary[]> => {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const [{ data: users }, { data: profiles }] = await Promise.all([
    supabase.from('users').select('id, first_name, last_name, role').in('id', ids),
    supabase
      .from('staff_profiles')
      .select('user_id, first_name, last_name, role, department')
      .in('user_id', ids),
  ]);
  const profileByUserId = new Map(
    ((profiles || []) as any[]).map((row) => [String(row.user_id), row])
  );
  return ((users || []) as any[]).map((user) => {
    const profile = profileByUserId.get(String(user.id)) || {};
    const first = profile.first_name || user.first_name || '';
    const last = profile.last_name || user.last_name || '';
    return {
      user_id: String(user.id),
      name: `${first} ${last}`.trim() || String(user.id),
      role: profile.role || user.role || null,
      department: profile.department || null,
    };
  });
};

const buildShiftExpectedConsumptionMap = async (
  branchId: number,
  kitchenShift: any,
  shiftItems: any[],
  additions: any[]
): Promise<Map<string, number>> => {
  const expectedByMatchKey = new Map<string, number>();
  const addExpected = (
    item: { item_id?: string | null; item_sku?: string | null; item_name?: string | null },
    quantity: number
  ) => {
    const qty = num(quantity);
    if (qty <= 0) return;
    for (const key of buildStandardMatchKeys(item)) {
      expectedByMatchKey.set(key, (expectedByMatchKey.get(key) || 0) + qty);
    }
  };

  const shiftId = String(kitchenShift?.id || '').trim();
  let posConsumptionRows: any[] = [];
  if (shiftId) {
    const { data, error } = await supabase
      .from('kitchen_shift_pos_consumption')
      .select('raw_item_sku, raw_item_name, raw_quantity_consumed')
      .eq('shift_id', shiftId);
    if (error) throw error;
    posConsumptionRows = (data || []) as any[];
  }

  if (posConsumptionRows.length > 0) {
    for (const row of posConsumptionRows) {
      addExpected(
        {
          item_sku: row.raw_item_sku || null,
          item_name: row.raw_item_name || null,
        },
        num(row.raw_quantity_consumed)
      );
    }
  } else {
    for (const item of shiftItems) {
      addExpected(
        {
          item_sku: item.item_sku || null,
          item_name: item.item_name || null,
        },
        num(item.sold_quantity)
      );
    }
  }

  const eventRefIds = [...new Set(
    additions
      .map((row: any) => String(row.reference_id || '').trim())
      .filter(Boolean)
  )];

  const [{ data: standardsData, error: standardsErr }, { data: eventOrdersData, error: eventOrdersErr }] =
    await Promise.all([
      supabase
        .from('channel_food_standards')
        .select('channel, raw_item_sku, raw_item_name, quantity_per_pax, event_id, package_definition_id, package_name')
        .eq('branch_id', branchId),
      eventRefIds.length
        ? supabase.from('event_orders').select('id, pax, menu_package, package_definition_id').in('id', eventRefIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
  if (standardsErr) throw standardsErr;
  if (eventOrdersErr) throw eventOrdersErr;

  const standards = ((standardsData || []) as any[]).map((row) => ({
    channel: String(row.channel || ''),
    raw_item_sku: row.raw_item_sku || null,
    raw_item_name: row.raw_item_name || null,
    quantity_per_pax: num(row.quantity_per_pax),
    event_id: row.event_id || null,
    package_definition_id: row.package_definition_id || null,
    package_name: row.package_name ? String(row.package_name).trim() : null,
  })) as ChannelStandardRow[];
  const eventOrderById = new Map<string, any>(
    ((eventOrdersData || []) as any[]).map((row) => [String(row.id), row])
  );

  const breakfastPax = num(kitchenShift?.breakfast_pax);
  if (breakfastPax > 0) {
    for (const standard of standards.filter((row) => row.channel === 'accommodation_breakfast')) {
      addExpected(
        {
          item_sku: standard.raw_item_sku,
          item_name: standard.raw_item_name,
        },
        standard.quantity_per_pax * breakfastPax
      );
    }
  }

  const staffMealPax = num(kitchenShift?.staff_meal_pax);
  if (staffMealPax > 0) {
    for (const standard of standards.filter((row) => row.channel === 'staff_meal')) {
      addExpected(
        {
          item_sku: standard.raw_item_sku,
          item_name: standard.raw_item_name,
        },
        standard.quantity_per_pax * staffMealPax
      );
    }
  }

  const eventChannels = new Set([
    'buffet',
    'conference_event',
    'outside_catering',
    'group_meal',
  ]);
  const additionsByChannel = new Map<string, any[]>();
  for (const addition of additions) {
    const channel = String(addition.purpose_channel || '').trim();
    if (!channel || !eventChannels.has(channel) || !addition.reference_id) continue;
    const bucket = additionsByChannel.get(channel) || [];
    bucket.push(addition);
    additionsByChannel.set(channel, bucket);
  }

  for (const [channel, rows] of additionsByChannel.entries()) {
    const refIds = [...new Set(rows.map((row) => String(row.reference_id)).filter(Boolean))];
    for (const refId of refIds) {
      const eventOrder = eventOrderById.get(refId);
      const pax = num(eventOrder?.pax);
      if (pax <= 0) continue;
      const packageName = String(eventOrder?.menu_package || '').trim().toLowerCase();
      const packageDefinitionId = String(eventOrder?.package_definition_id || '').trim();
      const matchedStandards = standards.filter((standard) => {
        if (standard.channel !== channel) return false;
        if (standard.event_id && String(standard.event_id) === refId) return true;
        if (
          packageDefinitionId &&
          String(standard.package_definition_id || '').trim() === packageDefinitionId
        ) {
          return true;
        }
        if (packageName && String(standard.package_name || '').trim().toLowerCase() === packageName) {
          return true;
        }
        return !standard.event_id && !String(standard.package_name || '').trim();
      });
      for (const standard of matchedStandards) {
        addExpected(
          {
            item_sku: standard.raw_item_sku,
            item_name: standard.raw_item_name,
          },
          standard.quantity_per_pax * pax
        );
      }
    }
  }

  return expectedByMatchKey;
};

const getPreviousKitchenStocktakeSeedRows = async (
  branchId: number,
  stocktakeDate: string,
  shift: 'A' | 'B'
): Promise<any[]> => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (COALESCE(kti.inventory_item_id::text, LOWER(TRIM(kti.item_name))))
              kti.inventory_item_id,
              kti.item_name,
              kti.closing_qty,
              ii.unit,
              ii.category,
              ii.sku
         FROM public.kitchen_stocktake_items kti
         JOIN public.kitchen_stocktake_shifts ks ON ks.id = kti.shift_id
         LEFT JOIN public.inventory_items ii ON ii.id = kti.inventory_item_id
       WHERE ks.branch_id = $1
          AND ks.status = 'approved'
          AND (ks.stocktake_date < $2 OR (ks.stocktake_date = $2 AND ks.shift < $3))
        ORDER BY COALESCE(kti.inventory_item_id::text, LOWER(TRIM(kti.item_name))),
                 ks.stocktake_date DESC,
                 ks.shift DESC`,
      [branchId, stocktakeDate, shift]
    );
    return rows || [];
  } catch (err) {
    logger.warn('getPreviousKitchenStocktakeSeedRows failed:', (err as Error).message);
    return [];
  }
};

/**
 * Read-only fallback: build stocktake rows straight from the fixed kitchen
 * catalog (KITCHEN_STOCKTAKE_ITEMS) when the branch has no standards-backed
 * rows to show. The standards-based ledger only surfaces items that have a
 * configured recipe/channel standard, so a branch that hasn't set those up
 * yet ends up with an empty stocktake and the storekeeper can't count
 * anything — a regression from the paper logbook this screen replaces. This
 * restores the canonical fixed catalog (seeded with each item's previous
 * closing as opening) so a physical count is always possible. No writes.
 */
const buildFixedKitchenCatalogRows = async (
  branchId: number,
  stocktakeDate: string,
  shift: 'A' | 'B',
  itemsByKey: Map<string, any>
): Promise<StocktakeContextRow[]> => {
  const { data: invRows } = await supabase
    .from('inventory_items')
    .select('id, item_name, unit, category, sku')
    .in('item_name', KITCHEN_STOCKTAKE_ITEMS);
  const invByName = new Map<string, any>();
  for (const row of (invRows || []) as any[]) {
    if (row.item_name) invByName.set(normalizeName(row.item_name), row);
  }
  const invIds = [...invByName.values()].map((r) => String(r.id)).filter(Boolean);
  const prevClosingByInvId = await getPreviousKitchenClosingByInvId(
    branchId,
    invIds,
    stocktakeDate,
    shift
  );

  return KITCHEN_STOCKTAKE_ITEMS.map((name) => {
    const inv = invByName.get(normalizeName(name)) || null;
    const invId = inv?.id ? String(inv.id) : null;
    const opening = invId ? num(prevClosingByInvId.get(invId)) : 0;
    const saved =
      itemsByKey.get(String(invId || '')) ||
      itemsByKey.get(normalizeName(name)) ||
      null;
    const closing = saved?.closing_qty != null ? num(saved.closing_qty) : opening;
    return {
      item_id: invId,
      item_name: name,
      opening_qty: opening,
      added_qty: 0,
      sold_qty: 0,
      spoilage_qty: 0,
      closing_qty: closing,
      variance: closing - opening,
      explanation: saved?.explanation ?? null,
      action_taken: saved?.action_taken ?? null,
      unit: inv?.unit || 'portion',
      category: inv?.category || 'KITCHEN MENU',
      item_type: 'FIXED_CATALOG',
      channel: 'POS Restaurant',
      item_sku: inv?.sku || null,
      expected_qty: 0,
      system_qty: opening,
    } satisfies StocktakeContextRow;
  });
};

const buildKitchenStocktakeContext = async (
  branchId: number,
  stocktakeDate: string,
  requestedShift: 'A' | 'B',
  existingShiftRow?: any | null
): Promise<Record<string, any>> => {
  const standardsCatalog = await fetchKitchenStandardsCatalog(branchId);
  const shiftMode = await getActiveShiftMode(branchId, stocktakeDate);
  const { data: kitchenShifts, error: kitchenShiftErr } = await supabase
    .from('kitchen_shifts')
    .select('id, shift_number, shift_date, shift_type, sub_shift_type, status, opened_by, opened_at, closed_at, department, assigned_chef_ids, assigned_dispense_ids')
    .eq('branch_id', branchId)
    .eq('shift_date', stocktakeDate)
    .order('opened_at', { ascending: true });
  if (kitchenShiftErr) throw kitchenShiftErr;

  const shifts = (kitchenShifts || []) as any[];
  const shiftA = shifts.find((row) => String(row.sub_shift_type || 'A').toUpperCase() === 'A') || null;
  const shiftB = shifts.find((row) => String(row.sub_shift_type || '').toUpperCase() === 'B') || null;

  const availableShifts: Array<{ value: 'A' | 'B'; label: string }> = [];
  availableShifts.push({
    value: 'A',
    label: buildKitchenShiftLabel(shiftMode, 'A'),
  });
  if (shiftMode === 'TWO_SHIFT' && (shiftB || existingShiftRow?.shift === 'B')) {
    availableShifts.push({ value: 'B', label: 'Shift B' });
  }

  const resolvedShift =
    shiftMode === 'SINGLE_SHIFT'
      ? 'A'
      : availableShifts.some((option) => option.value === requestedShift)
          ? requestedShift
          : 'A';

  const activeKitchenShift =
    shiftMode === 'SINGLE_SHIFT'
      ? shiftA || shiftB || shifts[0] || null
      : resolvedShift === 'B'
          ? shiftB
          : shiftA;

  const relevantShiftIds = [
    activeKitchenShift?.id,
    shiftA?.id,
    shiftB?.id,
  ].filter(Boolean) as string[];
  let handover: any | null = null;
  if (relevantShiftIds.length) {
    const { data: handoverRows, error: handoverErr } = await supabase
      .from('kitchen_shift_handovers')
      .select('*')
      .or(
        relevantShiftIds
          .map((id) => `outgoing_shift_id.eq.${id},incoming_shift_id.eq.${id}`)
          .join(',')
      )
      .order('confirmed_at', { ascending: false })
      .limit(5);
    if (handoverErr) throw handoverErr;
    const rows = (handoverRows || []) as any[];
    handover =
      rows.find((row) => row.incoming_shift_id === activeKitchenShift?.id) ||
      rows.find((row) => row.outgoing_shift_id === activeKitchenShift?.id) ||
      rows.find((row) => row.incoming_shift_id === shiftB?.id) ||
      rows.find((row) => row.outgoing_shift_id === shiftA?.id) ||
      rows[0] ||
      null;
  }

  const assignedChefIds = ((activeKitchenShift?.assigned_chef_ids || []) as string[]).filter(Boolean);
  const assignedDispenseIds = ((activeKitchenShift?.assigned_dispense_ids || []) as string[]).filter(Boolean);
  const outgoingWitnessIds = ((handover?.outgoing_witness_ids || []) as string[]).filter(Boolean);
  const incomingWitnessIds = ((handover?.incoming_witness_ids || []) as string[]).filter(Boolean);
  const staffSummaries = await getStaffSummaries([
    ...assignedChefIds,
    ...assignedDispenseIds,
    ...outgoingWitnessIds,
    ...incomingWitnessIds,
  ]);
  const staffByUserId = new Map(staffSummaries.map((row) => [row.user_id, row]));
  const assignedChefNames = assignedChefIds
    .map((id) => staffByUserId.get(String(id))?.name)
    .filter(Boolean) as string[];
  const assignedDispenseNames = assignedDispenseIds
    .map((id) => staffByUserId.get(String(id))?.name)
    .filter(Boolean) as string[];
  const outgoingWitnessNames = outgoingWitnessIds
    .map((id) => staffByUserId.get(String(id))?.name)
    .filter(Boolean) as string[];
  const incomingWitnessNames = incomingWitnessIds
    .map((id) => staffByUserId.get(String(id))?.name)
    .filter(Boolean) as string[];

  const autoDispenserName =
    assignedDispenseNames.join(', ') ||
    (resolvedShift === 'B' ? incomingWitnessNames.join(', ') : outgoingWitnessNames.join(', ')) ||
    null;
  const autoChefsOnDuty =
    assignedChefNames.length > 0
      ? assignedChefNames
      : (resolvedShift === 'B' ? incomingWitnessNames : outgoingWitnessNames);
  const autoConfirmationName =
    resolvedShift === 'B'
      ? (incomingWitnessNames.join(', ') || assignedDispenseNames.join(', ') || null)
      : (outgoingWitnessNames.join(', ') || assignedDispenseNames.join(', ') || null);

  const itemsByKey = new Map<string, any>();
  for (const item of (existingShiftRow?.items || []) as any[]) {
    const key = item.inventory_item_id || String(item.item_name || '').trim().toLowerCase();
    itemsByKey.set(String(key), item);
  }

  let rows: StocktakeContextRow[] = [];

  if (activeKitchenShift?.id) {
    const [{ data: shiftItems, error: shiftItemsErr }, { data: additions }, { data: productions }, { data: productionInputs }] =
      await Promise.all([
        supabase
          .from('kitchen_shift_items')
          .select('*')
          .eq('shift_id', activeKitchenShift.id)
          .order('item_name'),
        supabase
          .from('kitchen_shift_additions')
          .select('item_sku, purpose_channel, quantity')
          .eq('shift_id', activeKitchenShift.id),
        supabase
          .from('kitchen_shift_production')
          .select('produced_item_sku')
          .eq('shift_id', activeKitchenShift.id),
        supabase
          .from('kitchen_shift_production_inputs')
          .select('raw_item_sku')
          .eq('shift_id', activeKitchenShift.id),
      ]);
    if (shiftItemsErr) throw shiftItemsErr;

    const shiftItemList = (shiftItems || []) as any[];
    const additionsList = (additions || []) as any[];
    const skuList = shiftItemList.map((item) => String(item.item_sku || '')).filter(Boolean);
    const nameList = shiftItemList.map((item) => String(item.item_name || '')).filter(Boolean);
    const { data: inventoryMatches } = await supabase
      .from('inventory_items')
      .select('id, sku, item_name, unit, category')
      .or(
        [
          skuList.length ? `sku.in.(${skuList.map((sku) => `"${sku.replace(/"/g, '\\"')}"`).join(',')})` : null,
          nameList.length ? `item_name.in.(${nameList.map((name) => `"${name.replace(/"/g, '\\"')}"`).join(',')})` : null,
        ]
          .filter(Boolean)
          .join(',')
      );

    const inventoryBySku = new Map<string, any>();
    const inventoryByName = new Map<string, any>();
    for (const row of (inventoryMatches || []) as any[]) {
      if (row.sku) inventoryBySku.set(String(row.sku), row);
      if (row.item_name) inventoryByName.set(String(row.item_name).trim().toLowerCase(), row);
    }

    const channelTotalsBySku = new Map<string, Map<string, number>>();
    const additionsBySku = new Map<string, number>();
    for (const addition of additionsList) {
      const sku = String(addition.item_sku || '');
      if (!sku) continue;
      const channel = String(addition.purpose_channel || 'kitchen_session');
      const bucket = channelTotalsBySku.get(sku) || new Map<string, number>();
      bucket.set(channel, (bucket.get(channel) || 0) + num(addition.quantity));
      channelTotalsBySku.set(sku, bucket);
      additionsBySku.set(sku, (additionsBySku.get(sku) || 0) + num(addition.quantity));
    }
    const expectedConsumptionByKey = await buildShiftExpectedConsumptionMap(
      branchId,
      activeKitchenShift,
      shiftItemList,
      additionsList
    );
    const producedSkuSet = new Set<string>(
      ((productions || []) as any[])
        .map((row) => String(row.produced_item_sku || ''))
        .filter(Boolean)
    );
    const rawSkuSet = new Set<string>(
      ((productionInputs || []) as any[])
        .map((row) => String(row.raw_item_sku || ''))
        .filter(Boolean)
    );

    rows = shiftItemList.map((item: any) => {
      const inv =
        inventoryBySku.get(String(item.item_sku || '')) ||
        inventoryByName.get(String(item.item_name || '').trim().toLowerCase()) ||
        null;
      const standard = resolveStandardEntry(standardsCatalog.matchIndex, {
        item_id: inv?.id || null,
        item_sku: item.item_sku || inv?.sku || null,
        item_name: item.item_name || inv?.item_name || null,
      });
      if (!standard) return null;
      const saved =
        itemsByKey.get(inv?.id || '') ||
        itemsByKey.get(String(item.item_name || '').trim().toLowerCase()) ||
        null;
      const opening = num(item.opening_stock);
      const added = additionsBySku.get(String(item.item_sku || '')) ?? num(item.additions);
      const sold = num(item.sold_quantity);
      const spoilage = num(item.spoilage_quantity);
      const systemQty = opening + added - sold - spoilage;
      const expectedQty =
        expectedConsumptionByKey.get(`id:${String(inv?.id || '')}`) ??
        expectedConsumptionByKey.get(`sku:${normalizeCode(item.item_sku || inv?.sku || standard.item_sku || '')}`) ??
        expectedConsumptionByKey.get(`name:${normalizeName(item.item_name || inv?.item_name || standard.item_name || '')}`) ??
        0;
      const channelBucket = channelTotalsBySku.get(String(item.item_sku || ''));
      let channel: string | null = null;
      if (channelBucket && channelBucket.size > 0) {
        const top = [...channelBucket.entries()].sort((a, b) => b[1] - a[1])[0];
        channel = titleCaseWords(top[0]);
      } else if (producedSkuSet.has(String(item.item_sku || ''))) {
        channel = 'Production';
      } else {
        channel = standard.default_channel;
      }
      const itemType = producedSkuSet.has(String(item.item_sku || ''))
        ? 'TRUE_BATCH_PRODUCTION_OUTPUT'
        : rawSkuSet.has(String(item.item_sku || ''))
            ? 'PRODUCTION_RAW_INPUT'
            : standard.standard_type;
      const closing = saved?.closing_qty != null
        ? num(saved.closing_qty)
        : item.physical_count != null
            ? num(item.physical_count)
            : item.system_closing_stock != null
                ? num(item.system_closing_stock)
                : systemQty;
      return {
        item_id: inv?.id || standard.item_id || null,
        item_name: String(standard.item_name || item.item_name || item.item_sku || 'Unnamed Item'),
        opening_qty: opening,
        added_qty: added,
        sold_qty: sold,
        spoilage_qty: spoilage,
        closing_qty: closing,
        variance: closing - expectedQty,
        explanation: saved?.explanation ?? null,
        action_taken: saved?.action_taken ?? null,
        unit: standard.unit || inv?.unit || item.unit_of_measure || null,
        category: inv?.category || standard.category || null,
        item_type: itemType,
        channel,
        item_sku: item.item_sku || inv?.sku || standard.item_sku || null,
        expected_qty: expectedQty,
        system_qty: systemQty,
      } satisfies StocktakeContextRow;
    }).filter(Boolean) as StocktakeContextRow[];

    // Supplement: add any standards not covered by shift items so newly-configured
    // recipes appear even if they weren't in the opening seed.
    const coveredNames = new Set(rows.map((r) => normalizeName(r.item_name)));
    for (const standard of standardsCatalog.entries) {
      const key = normalizeName(standard.item_name);
      if (coveredNames.has(key)) continue;
      const saved =
        itemsByKey.get(String(standard.item_id || '')) ||
        itemsByKey.get(key) ||
        null;
      const closing = saved?.closing_qty != null ? num(saved.closing_qty) : 0;
      rows.push({
        item_id: standard.item_id || null,
        item_name: standard.item_name,
        opening_qty: 0,
        added_qty: 0,
        sold_qty: 0,
        spoilage_qty: 0,
        closing_qty: closing,
        variance: closing,
        explanation: saved?.explanation ?? null,
        action_taken: saved?.action_taken ?? null,
        unit: standard.unit || null,
        category: standard.category || null,
        item_type: standard.standard_type,
        channel: standard.default_channel,
        item_sku: standard.item_sku || null,
        expected_qty: 0,
        system_qty: 0,
      });
    }
  } else {
    const previousRows = await getPreviousKitchenStocktakeSeedRows(
      branchId,
      stocktakeDate,
      resolvedShift
    );
    const previousByMatchKey = new Map<string, any>();
    for (const row of previousRows) {
      const standard = resolveStandardEntry(standardsCatalog.matchIndex, {
        item_id: row.inventory_item_id || row.item_id || null,
        item_sku: row.sku || null,
        item_name: row.item_name || null,
      });
      if (!standard) continue;
      previousByMatchKey.set(normalizeName(standard.item_name), row);
    }

    const savedSeedItems = ((existingShiftRow?.items || []) as any[])
      .map((row: any) => {
        const standard = resolveStandardEntry(standardsCatalog.matchIndex, {
          item_id: row.inventory_item_id || row.item_id || null,
          item_sku: row.sku || null,
          item_name: row.item_name || null,
        });
        if (!standard) return null;
        return [normalizeName(standard.item_name), row] as const;
      })
      .filter(Boolean) as Array<readonly [string, any]>;
    for (const [key, row] of savedSeedItems) {
      if (!previousByMatchKey.has(key)) previousByMatchKey.set(key, row);
    }

    rows = standardsCatalog.entries.map((standard) => {
      const key = normalizeName(standard.item_name);
      const prior = previousByMatchKey.get(key) || null;
      const saved =
        itemsByKey.get(String(standard.item_id || '')) ||
        itemsByKey.get(key) ||
        null;
      const opening = num(prior?.closing_qty ?? prior?.opening_qty ?? 0);
      const closing = saved?.closing_qty != null ? num(saved.closing_qty) : opening;
      return {
        item_id: standard.item_id || prior?.inventory_item_id || prior?.item_id || null,
        item_name: standard.item_name,
        opening_qty: opening,
        added_qty: 0,
        sold_qty: 0,
        spoilage_qty: 0,
        closing_qty: closing,
        variance: closing - opening,
        explanation: saved?.explanation ?? prior?.explanation ?? null,
        action_taken: saved?.action_taken ?? prior?.action_taken ?? null,
        unit: standard.unit || prior?.unit || null,
        category: standard.category || prior?.category || null,
        item_type: standard.standard_type,
        channel: standard.default_channel,
        item_sku: standard.item_sku || prior?.sku || null,
        expected_qty: 0,
        system_qty: opening,
      } satisfies StocktakeContextRow;
    });
  }

  // Fallback: a branch with no configured standards (or whose shift items
  // match none) yields zero standards-backed rows, leaving the storekeeper
  // with nothing to count. Seed the canonical fixed catalog so the stocktake
  // always loads a countable ledger.
  let usedFixedCatalog = false;
  if (rows.length === 0) {
    rows = await buildFixedKitchenCatalogRows(
      branchId,
      stocktakeDate,
      resolvedShift,
      itemsByKey
    );
    usedFixedCatalog = rows.length > 0;
  }

  rows = rows
    .sort((a, b) => {
      const typeDelta = getStandardTypeRank(b.item_type) - getStandardTypeRank(a.item_type);
      if (typeDelta !== 0) return typeDelta;
      return a.item_name.localeCompare(b.item_name);
    });

  return {
    branch_id: branchId,
    stocktake_date: stocktakeDate,
    shift: resolvedShift,
    shift_mode: shiftMode,
    shift_label: buildKitchenShiftLabel(shiftMode, resolvedShift),
    stocktake_type: inferStocktakeType(shiftMode, activeKitchenShift, resolvedShift),
    available_shifts: availableShifts,
    allow_shift_b: availableShifts.some((row) => row.value === 'B'),
    kitchen_shift_id: activeKitchenShift?.id || null,
    kitchen_shift_number: activeKitchenShift?.shift_number || null,
    kitchen_shift_status: activeKitchenShift?.status || null,
    department: activeKitchenShift?.department || 'KITCHEN',
    standards_configured: standardsCatalog.entries.length > 0,
    fixed_catalog: usedFixedCatalog,
    auto_dispenser_name: autoDispenserName,
    auto_cheps_on_duty: autoChefsOnDuty,
    auto_confirmation_name: autoConfirmationName,
    rows,
  };
};

const resolveRestaurantOutlet = async (branchId: number): Promise<any | null> => {
  const { data, error } = await supabase
    .from('pos_outlets')
    .select('id, name, outlet_type')
    .eq('branch_id', branchId)
    .in('outlet_type', ['restaurant'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};

const approveKitchenSession = async (
  existing: any,
  actorId: string | null | undefined,
  idempotencyKey: string,
) => {
  const context = await buildKitchenStocktakeContext(
    existing.branch_id,
    existing.stocktake_date,
    existing.shift,
    existing,
  );
  const sourceByName = new Map<string, any>(
    (context.rows || []).map((row: any) => [String(row.item_name || '').trim().toLowerCase(), row]),
  );
  const sessionItems = (existing.items || []) as any[];
  const restaurantOutlet = await resolveRestaurantOutlet(existing.branch_id);
  const postingLocation = restaurantOutlet?.id
    ? {
        branchId: existing.branch_id,
        locationCode: `OUTLET-${existing.branch_id}-${String(restaurantOutlet.id).toUpperCase()}`,
        locationName: restaurantOutlet.name || 'Restaurant',
        locationType: 'pos_outlet' as const,
        outletId: String(restaurantOutlet.id),
      }
    : {
        branchId: existing.branch_id,
        departmentCode: 'KITCHEN',
        locationCode: `DEPT-${existing.branch_id}-KITCHEN`,
        locationName: 'Kitchen Department',
        locationType: 'department' as const,
      };

  const alreadyApprovedWithDocument = existing.status === 'approved' && existing.document_id ? existing : null;
  const reviewedBy = alreadyApprovedWithDocument?.reviewed_by || actorId || null;
  const reviewedAt = alreadyApprovedWithDocument?.reviewed_at || new Date().toISOString();

  let posting = null;
  if (!alreadyApprovedWithDocument) {
    posting = await InventoryStocktakePostingService.postApproval({
      actorId: actorId || '',
      branchId: existing.branch_id,
      documentReason: `Kitchen stocktake approval ${existing.stocktake_date} shift ${existing.shift}`,
      idempotencyKey,
      lines: sessionItems.map((item: any) => {
        const source = sourceByName.get(String(item.item_name || '').trim().toLowerCase());
        return {
          itemName: source?.item_name || item.item_name,
          itemSku: source?.item_sku,
          metadata: { kitchen_stocktake_shift_id: existing.id, kitchen_shift: existing.shift },
          physicalQuantity: num(item.closing_qty),
          systemQuantity: num(source?.system_qty),
          unitCost: num(source?.cost_price),
        };
      }).filter((row: any) => row.itemSku),
      location: postingLocation,
      metadata: { branch_id: existing.branch_id, shift: existing.shift, stocktake_date: existing.stocktake_date },
      scope: 'kitchen',
      sourceId: String(existing.id),
      sourceTable: 'kitchen_stocktake_shifts',
      stocktakeDate: existing.stocktake_date,
    });
  }

  const documentFields = posting ? {
    document_id: posting.document.document_id,
    document_number: posting.document.document_number,
    posted_at: posting.document.posted_at,
    posting_status: posting.document.posting_status,
    reversal_of_document_id: posting.document.reversal_of_document_id,
  } : {
    document_id: alreadyApprovedWithDocument?.document_id ?? null,
    document_number: alreadyApprovedWithDocument?.document_number ?? null,
    posted_at: alreadyApprovedWithDocument?.posted_at ?? null,
    posting_status: alreadyApprovedWithDocument?.posting_status ?? null,
    reversal_of_document_id: alreadyApprovedWithDocument?.reversal_of_document_id ?? null,
  };

  const { data, error } = await supabase
    .from('kitchen_stocktake_shifts')
    .update({ status: 'approved', reviewed_by: reviewedBy, reviewed_at: reviewedAt, ...documentFields })
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw error;

  if (sessionItems.length > 0) {
    try {
      await db.query(
        `UPDATE public.pos_outlet_items poi
         SET current_stock = kti.closing_qty::numeric,
             updated_at    = NOW()
         FROM (VALUES ${sessionItems.map((_: any, i: number) => `($${i * 2 + 1}::text, $${i * 2 + 2}::numeric)`).join(', ')})
               AS kti(item_name, closing_qty)
         JOIN public.pos_outlets po ON po.branch_id = $${sessionItems.length * 2 + 1}
                                   AND po.outlet_type = 'restaurant'
         WHERE poi.outlet_id = po.id
           AND LOWER(TRIM(poi.name)) = LOWER(TRIM(kti.item_name))`,
        [...sessionItems.flatMap((it: any) => [it.item_name, num(it.closing_qty)]), existing.branch_id],
      );
    } catch (err) {
      logger.warn('approveKitchenSession: pos_outlet_items sync failed:', (err as Error).message);
    }
  }

  return { data, posting };
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

    const { data } = await approveKitchenSession(
      existing,
      req.user?.id || null,
      req.header('Idempotency-Key') || `kitchen-stocktake-approve-${existing.branch_id}-${existing.stocktake_date}-${existing.shift}`,
    );

    res.status(200).json({ success: true, data: withKitchenPostingFields(data) });
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

    const context = await buildKitchenStocktakeContext(
      existingShift.branch_id,
      existingShift.stocktake_date,
      toShiftLetter(existingShift.shift),
      { ...existingShift, items: updatedItems || [] }
    );
    const sourceByName = new Map<string, StocktakeContextRow>(
      context.rows.map((row: StocktakeContextRow) => [row.item_name.trim().toLowerCase(), row])
    );
    const itemsForSync = (updatedItems || []).map((it: any) => ({
      ...it,
      inventory_item_id: it.inventory_item_id || sourceByName.get(String(it.item_name || '').trim().toLowerCase())?.item_id || null,
      spoilage_qty: sourceByName.get(String(it.item_name || '').trim().toLowerCase())?.spoilage_qty ?? 0,
      sold_qty: sourceByName.get(String(it.item_name || '').trim().toLowerCase())?.sold_qty ?? 0,
      opening_qty: sourceByName.get(String(it.item_name || '').trim().toLowerCase())?.opening_qty ?? num(it.opening_qty),
      added_qty: sourceByName.get(String(it.item_name || '').trim().toLowerCase())?.added_qty ?? num(it.added_qty),
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
    const requestedShift = toShiftLetter(req.query.shift);
    const stocktakeDate = String(req.query.date || new Date().toISOString().split('T')[0]);

    const { data: shiftRow, error: shiftErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('*, items:kitchen_stocktake_items(*)')
      .eq('branch_id', branchId)
      .eq('stocktake_date', stocktakeDate)
      .eq('shift', requestedShift)
      .maybeSingle();
    if (shiftErr) throw shiftErr;

    let largePct = 3.0;
    let extremePct = 10.0;
    try {
      const { data: settings } = await supabase
        .from('branch_settings')
        .select('stocktake_variance_large_pct, stocktake_variance_extreme_pct')
        .eq('branch_id', branchId)
        .maybeSingle();
      if (settings) {
        if (settings.stocktake_variance_large_pct != null) {
          largePct = parseFloat(settings.stocktake_variance_large_pct);
        }
        if (settings.stocktake_variance_extreme_pct != null) {
          extremePct = parseFloat(settings.stocktake_variance_extreme_pct);
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch branch settings thresholds in getKitchenStocktake:', err);
    }

    const context = await buildKitchenStocktakeContext(
      branchId,
      stocktakeDate,
      requestedShift,
      shiftRow
    );

    res.status(200).json({
      success: true,
      data: withKitchenPostingFields({
        branch_id: branchId,
        stocktake_date: stocktakeDate,
        shift: context.shift,
        shift_mode: context.shift_mode,
        shift_label: context.shift_label,
        stocktake_type: context.stocktake_type,
        available_shifts: context.available_shifts,
        allow_shift_b: context.allow_shift_b,
        kitchen_shift_id: context.kitchen_shift_id,
        kitchen_shift_number: context.kitchen_shift_number,
        kitchen_shift_status: context.kitchen_shift_status,
        department: context.department,
        standards_configured: context.standards_configured,
        fixed_catalog: context.fixed_catalog,
        dispenser_name: shiftRow?.dispenser_name ?? context.auto_dispenser_name ?? null,
        cheps_on_duty: (shiftRow?.cheps_on_duty?.length ? shiftRow.cheps_on_duty : context.auto_cheps_on_duty) ?? [],
        confirmation_name: shiftRow?.confirmation_name ?? context.auto_confirmation_name ?? null,
        status: shiftRow?.status ?? 'draft',
        items: context.rows.map((item: any) => ({ ...item, issuance: 0 })),
        stocktake_variance_large_pct: largePct,
        stocktake_variance_extreme_pct: extremePct,
      }),
    });
  } catch (error) {
    logger.error('getKitchenStocktake failed:', error);
    next(error);
  }
};

/**
 * @desc    Save (and optionally submit) a kitchen stocktake for a branch/date/shift.
 * @route   POST /api/storekeeping/kitchen-stocktake
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const saveKitchenStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = resolveBranchId(req) || parseInt(req.body?.branch_id);
    if (!Number.isInteger(branchId)) {
      res.status(400).json({ success: false, message: 'branch_id is required' });
      return;
    }
    const requestedShift = toShiftLetter(req.body?.shift);
    const stocktakeDate = req.body?.stocktake_date || new Date().toISOString().split('T')[0];
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const submit = Boolean(req.body?.submit);
    const chepsOnDuty = Array.isArray(req.body?.cheps_on_duty)
      ? req.body.cheps_on_duty.filter((n: any) => String(n || '').trim()).slice(0, 5)
      : [];

    const { data: existingShift, error: existingShiftErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('*, items:kitchen_stocktake_items(*)')
      .eq('branch_id', branchId)
      .eq('stocktake_date', stocktakeDate)
      .eq('shift', requestedShift)
      .maybeSingle();
    if (existingShiftErr) throw existingShiftErr;

    const context = await buildKitchenStocktakeContext(
      branchId,
      stocktakeDate,
      requestedShift,
      existingShift
    );

    const shiftPayload: Record<string, any> = {
      branch_id: branchId,
      stocktake_date: stocktakeDate,
      shift: context.shift,
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

    const itemRows = context.rows.map((row: StocktakeContextRow) => {
      const submitted = items.find(
        (it: any) =>
          (it.item_id && row.item_id && String(it.item_id) === String(row.item_id)) ||
          String(it.item_name || '').trim().toLowerCase() === row.item_name.trim().toLowerCase()
      );
      return {
        shift_id: shiftRow.id,
        item_name: row.item_name,
        inventory_item_id: row.item_id || null,
        opening_qty: num(row.opening_qty),
        added_qty: num(row.added_qty),
        closing_qty: submitted?.closing_qty != null ? num(submitted.closing_qty) : num(row.closing_qty),
        explanation: submitted?.explanation || row.explanation || null,
        action_taken: submitted?.action_taken || row.action_taken || null,
        updated_at: new Date().toISOString(),
      };
    });

    const { data: savedItems, error: itemsErr } = await supabase
      .from('kitchen_stocktake_items')
      .upsert(itemRows, { onConflict: 'shift_id,item_name' })
      .select('*');
    if (itemsErr) throw itemsErr;

    const sourceByName = new Map<string, StocktakeContextRow>(
      context.rows.map((row: StocktakeContextRow) => [row.item_name.trim().toLowerCase(), row])
    );
    const itemsForSync = (savedItems || itemRows).map((it: any) => {
      const source = sourceByName.get(String(it.item_name || '').trim().toLowerCase());
      return {
        ...it,
        inventory_item_id: it.inventory_item_id || source?.item_id || null,
        opening_qty: source?.opening_qty ?? num(it.opening_qty),
        added_qty: source?.added_qty ?? num(it.added_qty),
        spoilage_qty: source?.spoilage_qty ?? 0,
        sold_qty: source?.sold_qty ?? 0,
      };
    });
    await syncKitchenStocktakeToStockCounts(branchId, stocktakeDate, shiftRow.shift, shiftRow.status, itemsForSync);

    if (submit) {
      for (const it of itemsForSync) {
        const source = sourceByName.get(String(it.item_name || '').trim().toLowerCase());
        const itemSku = source?.item_sku || it.item_sku;
        const physicalQty = num(it.closing_qty);
        if (itemSku && physicalQty >= 0) {
          try {
            await supabase
              .from('branch_stock')
              .upsert({
                branch_id: branchId,
                item_sku: itemSku,
                quantity: physicalQty,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'branch_id,item_sku' });
          } catch (err) {
            logger.warn(`Failed to sync branch_stock for ${itemSku} on kitchen stocktake submit:`, err);
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      data: withKitchenPostingFields({
        ...shiftRow,
        shift_mode: context.shift_mode,
        shift_label: context.shift_label,
        stocktake_type: context.stocktake_type,
        available_shifts: context.available_shifts,
        allow_shift_b: context.allow_shift_b,
        kitchen_shift_id: context.kitchen_shift_id,
        kitchen_shift_number: context.kitchen_shift_number,
        kitchen_shift_status: context.kitchen_shift_status,
        department: context.department,
        standards_configured: context.standards_configured,
        dispenser_name: shiftRow.dispenser_name ?? context.auto_dispenser_name ?? null,
        cheps_on_duty: (shiftRow.cheps_on_duty?.length ? shiftRow.cheps_on_duty : context.auto_cheps_on_duty) ?? [],
        confirmation_name: shiftRow.confirmation_name ?? context.auto_confirmation_name ?? null,
        items: itemsForSync.map((item: any) => ({ ...item, issuance: 0 })),
      }),
    });
  } catch (error) {
    logger.error('saveKitchenStocktake failed:', error);
    next(error);
  }
};
