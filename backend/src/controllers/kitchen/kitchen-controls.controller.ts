import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { AppError } from '../../middleware/errorHandler';
import db from '../../db';
import { staffProfileSummaries, resolveStaffProfileId } from '../kitchen-shift.controller';
import { KITCHEN_STOCKTAKE_ITEMS, getApprovedKitchenSpoilageByName, getKitchenSoldByName, getKitchenSoldByNameForDay } from '../storekeeping/kitchen-stocktake.controller';

// Recipe mapping matching what was updated in food_controls_analysis.md
const RECIPE_MAP: Record<string, { parent: string; yield: number }> = {
  // BEEF
  'Special Managu Mix': { parent: 'BEEF', yield: 10 },
  'Sukuma Mix': { parent: 'BEEF', yield: 10 },
  'Cabbage Mix': { parent: 'BEEF', yield: 10 },
  'Special Pilau': { parent: 'BEEF', yield: 10 }, // Note: Also uses RICE
  'Special Rice': { parent: 'BEEF', yield: 10 },  // Note: Also uses RICE
  
  // MINCED MEAT
  'Samosa': { parent: 'MINCED MEAT', yield: 30 }, // Note: Also uses EXE FLOUR
  'Special Samosa': { parent: 'MINCED MEAT', yield: 30 }, // Note: Also uses EXE FLOUR

  // EXE FLOUR
  'Chapati': { parent: 'EXE FLOUR', yield: 30 / 2 }, // Yields 30 per 2kg -> 15 per kg
  'Brown Chapati': { parent: 'EXE FLOUR', yield: 15 },
  'Dried Chapati': { parent: 'EXE FLOUR', yield: 15 },
  'Chapati Roll Broiler': { parent: 'EXE FLOUR', yield: 15 },
  'Chapati Roll Kienyeji': { parent: 'EXE FLOUR', yield: 15 },
  'Ndazi': { parent: 'EXE FLOUR', yield: 15 }, // Assuming Ndazi = Mandazi
  'Mahamri': { parent: 'EXE FLOUR', yield: 15 },

  // MILK
  'Tea Pot': { parent: 'MILK', yield: 4 },
  'Tea Masala': { parent: 'MILK', yield: 4 },
  'Special Tea': { parent: 'MILK', yield: 4 },
  'White Tea': { parent: 'MILK', yield: 4 },
  'Ginger Tea': { parent: 'MILK', yield: 4 },
  'Tea Mug': { parent: 'MILK', yield: 4 },

  // RICE
  'Pilau': { parent: 'RICE', yield: 7 },
  'Rice Plain': { parent: 'RICE', yield: 7 },
  // 'Special Pilau' and 'Special Rice' handled via special multi-parent logic below

  // AJAB FLOUR
  'Ugali White': { parent: 'AJAB FLOUR', yield: 8 / 2 }, // 4 per kg
  'Ugali Brown': { parent: 'AJAB FLOUR', yield: 4 },

  // CHICKEN
  '1/4 Kg Chicken Dry Fry': { parent: 'FULL CHICKEN', yield: 4 },
  '1/4 Kg Chicken Wet Fry': { parent: 'FULL CHICKEN', yield: 4 },
  '1/4 Kg Chicken Pan Fry': { parent: 'FULL CHICKEN', yield: 4 },
  '1/4 Kg Kuku Kienyeji Wet Fry': { parent: 'FULL CHICKEN', yield: 4 },
  '1/4 Kg Kuku Kienyeji Dry Fry': { parent: 'FULL CHICKEN', yield: 4 },
  '1/4 Kg Kuku Kienyeji Pan Fry': { parent: 'FULL CHICKEN', yield: 4 },
  
  '1/2 Kg Chicken Dry Fry': { parent: 'FULL CHICKEN', yield: 2 },
  '1/2 Kg Chicken Wet Fry': { parent: 'FULL CHICKEN', yield: 2 },
  '1/2 Kg Chicken Pan Fry': { parent: 'FULL CHICKEN', yield: 2 },
  '1/2 Kg Kuku Kienyeji Pan Fry': { parent: 'FULL CHICKEN', yield: 2 },
  '1/2 Kg Kuku Kienyeji Wet Fry': { parent: 'FULL CHICKEN', yield: 2 },
  '1/2 Kg Kuku Kienyeji Dry Fry': { parent: 'FULL CHICKEN', yield: 2 },
  
  'Full Kuku Kienyeji Dry Fry': { parent: 'FULL CHICKEN', yield: 1 },
  'Full Kuku Kienyeji Pan Fry': { parent: 'FULL CHICKEN', yield: 1 },
  'Kuku Kienyeji Wet Fry FULL': { parent: 'FULL CHICKEN', yield: 1 },
  '1 Kg Chicken Pan Fry': { parent: 'FULL CHICKEN', yield: 1 },
  '1 Kg Chicken Dry Fry': { parent: 'FULL CHICKEN', yield: 1 },
  '1 Kg Chicken Wet Fry': { parent: 'FULL CHICKEN', yield: 1 },
  'Special Chicken': { parent: 'FULL CHICKEN', yield: 1 },

  // POTATOES
  'Chips': { parent: 'POTATOES', yield: 15 / 20 }, // 0.75 plates per kg -> 1/0.75 kg per plate
  'Chips Masala': { parent: 'POTATOES', yield: 0.75 },
  'Garlic Chips': { parent: 'POTATOES', yield: 0.75 },
  'Roast Potatoes': { parent: 'POTATOES', yield: 0.75 },
  'Potato Wedges': { parent: 'POTATOES', yield: 0.75 },
  'Saute Potatoes': { parent: 'POTATOES', yield: 0.75 },
  'Mashed Potatoes': { parent: 'POTATOES', yield: 0.75 }
};

// Handle items that link to multiple parents
const getParentUsages = (itemName: string, quantity: number): { parent: string; amount: number }[] => {
  const usages: { parent: string; amount: number }[] = [];
  
  // Primary recipe
  const recipe = RECIPE_MAP[itemName];
  if (recipe) {
    usages.push({ parent: recipe.parent, amount: quantity / recipe.yield });
  }

  // Multi-parent exceptions
  if (itemName === 'Special Pilau' || itemName === 'Special Rice') {
    // Also uses RICE (1/7 kg per plate)
    usages.push({ parent: 'RICE', amount: quantity / 7 });
  }
  if (itemName === 'Samosa' || itemName === 'Special Samosa') {
    // Also uses EXE FLOUR (assume 1/30 kg per samosa or similar, let's just do 0.033)
    usages.push({ parent: 'EXE FLOUR', amount: quantity / 30 });
  }

  return usages;
};

// GET /api/kitchen/shift-controls/analyze
export const analyzeShiftControls = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, shift_date, shift_type } = req.query;

    if (!branch_id || !shift_date || !shift_type) {
      throw new AppError('branch_id, shift_date, and shift_type are required', 400);
    }

    // 1. Fetch POS Orders for this date and shift
    // We fetch cashier_shift_logs to find the shift IDs for this date
    // But since the storekeeper selects Date + Shift, we must find matching shifts
    // Cashier shifts don't always have a 'shift_type' (A/B), so we'll fetch shifts opened on that date.
    // If shift_type is A (Morning), maybe 6am to 6pm. B (Night) 6pm to 6am.
    // However, kitchen_production_sessions explicitly have 'shift_type'.
    
    // First, fetch kitchen sessions for this branch, date, shift_type.
    // NOTE: this previously embedded a "kitchen_session_closing_stock" relation
    // that does not exist as a table in the live schema (confirmed via
    // PostgREST: PGRST205 "Could not find the table") — every call to this
    // endpoint was throwing before reaching any response. There is no
    // closing-stock tracking table at all today, so actual usage is simply
    // the sum of kitchen_session_issues (items given to kitchen), matching
    // the comment below.
    const { data: kitchenSessions, error: ksErr } = await supabase
      .from('kitchen_production_sessions')
      .select('id, session_number, status, issues:kitchen_session_issues(*)')
      .eq('branch_id', branch_id)
      .eq('session_date', shift_date)
      .eq('shift_type', shift_type);

    if (ksErr) throw ksErr;

    // "kitchen_session_issues" = items given to kitchen for this session.
    const actualUsageMap: Record<string, number> = {};

    let kitchen_session_id = null;

    if (kitchenSessions && kitchenSessions.length > 0) {
      kitchen_session_id = kitchenSessions[0].id;
      kitchenSessions.forEach(session => {
        session.issues?.forEach((issue: { item_name: string; quantity_issued: number }) => {
          const parent = issue.item_name;
          actualUsageMap[parent] = (actualUsageMap[parent] || 0) + Number(issue.quantity_issued || 0);
        });
      });
    }

    // 2. Fetch Cashier Shifts for that date
    // We'll just fetch pos_shift_orders that fall within the time bounds of that shift
    // If shift_date = 2026-06-19, shift_type = A (06:00 - 18:00) vs B (18:00 - 06:00 next day)
    const startDate = new Date(String(shift_date));
    const startTime = new Date(startDate);
    const endTime = new Date(startDate);

    if (shift_type === 'A') {
      startTime.setHours(6, 0, 0, 0);
      endTime.setHours(18, 0, 0, 0);
    } else {
      startTime.setHours(18, 0, 0, 0);
      endTime.setDate(endTime.getDate() + 1);
      endTime.setHours(6, 0, 0, 0);
    }

    const { data: posOrders, error: posErr } = await supabase
      .from('pos_shift_orders')
      .select('id, items')
      .eq('branch_id', Number(branch_id))
      .or('status.in.(paid,credit_bill),payment_status.in.(paid,credit_bill)')
      .gte('created_at', startTime.toISOString())
      .lte('created_at', endTime.toISOString());
    
    if (posErr) throw posErr;

    const productionRules = await loadProductionYieldRules(Number(branch_id));

    // 3. Aggregate Sold Items
    const expectedUsageMap: Record<string, number> = {};
    const itemSales: Record<string, number> = {};

    posOrders?.forEach(order => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (Array.isArray(items)) {
        items.forEach((item: { name: string; quantity: number }) => {
          const qty = Number(item.quantity || 1);
          itemSales[item.name] = (itemSales[item.name] || 0) + qty;

          const dynamicRules = findYieldRulesForSoldItem(item.name, productionRules);
          if (dynamicRules.length > 0) {
            dynamicRules.forEach(rule => {
              const rawNeeded = qty * (rule.raw_quantity / rule.produced_quantity);
              expectedUsageMap[rule.raw_item_name] = (expectedUsageMap[rule.raw_item_name] || 0) + rawNeeded;
            });
          } else {
            const usages = getParentUsages(item.name, qty);
            usages.forEach(u => {
              expectedUsageMap[u.parent] = (expectedUsageMap[u.parent] || 0) + u.amount;
            });
          }
        });
      }
    });

    // 4. Combine into Variances (Raw Ingredients + Prepared Counter Stocktake)
    const parents = [...new Set([...Object.keys(expectedUsageMap), ...Object.keys(actualUsageMap)])];

    // Fetch the kitchen stocktake shift and its items
    const { data: stocktakeShift, error: stErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('id, status, items:kitchen_stocktake_items(*)')
      .eq('branch_id', Number(branch_id))
      .eq('stocktake_date', shift_date)
      .eq('shift', shift_type)
      .maybeSingle();

    if (stErr) throw stErr;

    const preparedControls: Array<{
      item_name: string;
      expected_usage: number;
      actual_usage: number;
      variance: number;
      is_prepared: boolean;
    }> = [];

    const has_stocktake = !!stocktakeShift;
    const stocktake_status = stocktakeShift?.status || null;

    if (stocktakeShift && stocktakeShift.items) {
      const itemNames = stocktakeShift.items.map((i: { item_name: string }) => i.item_name);

      // Fetch restaurant sales for prepared items within shift time window
      const { rows: soldRows } = await db.query(
        `SELECT LOWER(TRIM(roi.item_name)) AS item_name_norm, COALESCE(SUM(roi.quantity), 0) AS sold_qty
         FROM public.restaurant_order_items roi
         JOIN public.restaurant_orders ro ON ro.id = roi.order_id
         WHERE ro.branch_id = $1
           AND ro.created_at >= $2 AND ro.created_at <= $3
           AND COALESCE(ro.status, '') != 'cancelled'
           AND LOWER(TRIM(roi.item_name)) = ANY($4)
         GROUP BY LOWER(TRIM(roi.item_name))`,
        [Number(branch_id), startTime.toISOString(), endTime.toISOString(), itemNames.map((n: string) => n.toLowerCase().trim())]
      );
      const soldMap = new Map<string, number>((soldRows || []).map((r: { item_name_norm: string; sold_qty: string | number }) => [r.item_name_norm, Number(r.sold_qty || 0)]));

      // Fetch approved spoilage logs within shift date/type
      const { data: spoilageData, error: spErr } = await supabase
        .from('branch_spoilage_log')
        .select('item_name, quantity')
        .eq('branch_id', Number(branch_id))
        .eq('area', 'kitchen')
        .eq('status', 'approved')
        .eq('spoilage_date', shift_date)
        .eq('shift', shift_type)
        .in('item_name', itemNames);

      const spoilageMap = new Map<string, number>();
      if (!spErr && spoilageData) {
        spoilageData.forEach((row: { item_name: string; quantity: number }) => {
          const key = row.item_name.toLowerCase().trim();
          spoilageMap.set(key, (spoilageMap.get(key) || 0) + Number(row.quantity || 0));
        });
      }

      // Calculate prepared item variances
      stocktakeShift.items.forEach((item: { item_name: string; opening_qty?: number; added_qty?: number; closing_qty?: number }) => {
        const name = item.item_name;
        const normName = name.toLowerCase().trim();
        const open = Number(item.opening_qty || 0);
        const added = Number(item.added_qty || 0);
        const closing = Number(item.closing_qty || 0);
        const sold = soldMap.get(normName) || 0;
        const spoilage = spoilageMap.get(normName) || 0;

        // expected = what should be left in stock: open + added - sold - spoilage
        const expected = open + added - sold - spoilage;
        // variance = expected - closing (positive = shortage, negative = surplus)
        const variance = expected - closing;

        preparedControls.push({
          item_name: `${name} (Prepared counter)`,
          expected_usage: Number(expected.toFixed(3)),
          actual_usage: Number(closing.toFixed(3)),
          variance: Number(variance.toFixed(3)),
          is_prepared: true
        });
      });
    }

    const rawResults = parents.map(parent => {
      const expected = expectedUsageMap[parent] || 0;
      const actual = actualUsageMap[parent] || 0;
      const variance = expected - actual;

      return {
        item_name: `${parent} (Raw ingredient)`,
        expected_usage: Number(expected.toFixed(3)),
        actual_usage: Number(actual.toFixed(3)),
        variance: Number(variance.toFixed(3)),
        is_prepared: false
      };
    });

    const combinedControls = [...rawResults, ...preparedControls];

    res.status(200).json({
      success: true,
      data: {
        shift_date,
        shift_type,
        kitchen_session_id,
        has_stocktake,
        stocktake_status,
        sales_summary: itemSales,
        controls: combinedControls
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/kitchen/shift-controls/bill-staff
export const billStaffForShortage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, shift_date, shift_type, item_name, variance, staff_id, amount, reason } = req.body;

    if (!branch_id || !staff_id || !amount) {
      throw new AppError('Missing required fields for billing', 400);
    }

    // Create the credit bill
    const { data: bill, error: billErr } = await supabase
      .from('staff_credit_bills')
      .insert({
        branch_id,
        staff_id,
        amount,
        balance: amount,
        paid_amount: 0,
        description: reason || `Kitchen Shortage: ${item_name} (${variance} variance)`,
        status: 'pending',
        bill_date: shift_date
      })
      .select()
      .single();

    if (billErr) throw billErr;

    // Save the shift control record to link it
    const { error: controlErr } = await supabase
      .from('kitchen_shift_controls')
      .upsert({
        branch_id,
        shift_date,
        shift_type,
        item_name,
        variance,
        status: 'billed',
        credit_bill_id: bill.id
      }, { onConflict: 'branch_id, shift_date, shift_type, item_name' });

    if (controlErr) throw controlErr;

    res.status(200).json({
      success: true,
      message: 'Staff billed successfully',
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// DAILY FOOD CONTROL DASHBOARD
// Theoretical (BOM) vs actual ingredient consumption, kitchen production vs
// POS sales, and food cost % — all scoped by branch_id + a single calendar
// date (not the A/B shift split used by analyzeShiftControls above).
// =====================================================

const DEFAULT_FOOD_COST_TARGET_PERCENT = 30;
const VARIANCE_TOLERANCE_GREEN_PCT = 5;
const VARIANCE_TOLERANCE_ORANGE_PCT = 15;

const normalizeItemName = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Sold menu-item names rarely match recipe names exactly (e.g. recipe
// "Samosa (Standard Yield)" vs the POS item "Samosa") — same fuzzy
// resolution philosophy already used for catalog/SKU matching on the
// branch storekeeper PO and stock-request screens.
const findRecipeForSoldItem = <T extends { menu_item_name: string }>(
  soldName: string,
  recipes: T[]
): T | null => {
  const normalizedSold = normalizeItemName(soldName);
  if (!normalizedSold) return null;
  for (const recipe of recipes) {
    if (normalizeItemName(recipe.menu_item_name) === normalizedSold) return recipe;
  }
  for (const recipe of recipes) {
    const normalizedRecipe = normalizeItemName(recipe.menu_item_name);
    if (normalizedRecipe.includes(normalizedSold) || normalizedSold.includes(normalizedRecipe)) {
      return recipe;
    }
  }
  return null;
};

type ProductionYieldRule = {
  id: string;
  raw_item_sku: string;
  raw_item_name: string;
  raw_quantity: number;
  raw_unit: string;
  produced_item_name: string;
  produced_item_sku?: string | null;
  produced_quantity: number;
  produced_unit?: string | null;
  pos_outlet_item_id?: string | null;
};

const loadProductionYieldRules = async (branchId: number): Promise<ProductionYieldRule[]> => {
  const { data, error } = await supabase
    .from('kitchen_production_recipes')
    .select('id, raw_item_sku, raw_item_name, raw_quantity, raw_unit, produced_item_name, produced_item_sku, produced_quantity, produced_unit, pos_outlet_item_id, is_active')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('raw_item_name', { ascending: true });

  if (error) throw error;
  return (data || [])
    .map((row: any) => ({
      ...row,
      raw_quantity: Number(row.raw_quantity || 0),
      produced_quantity: Number(row.produced_quantity || 0),
    }))
    .filter((row: ProductionYieldRule) =>
      row.raw_item_sku &&
      row.raw_item_name &&
      row.raw_quantity > 0 &&
      row.produced_item_name &&
      row.produced_quantity > 0
    );
};

// Exact, ID-based link (set via the Food Control "Link to POS Menu Item"
// picker) — unambiguous, so every rule sharing that outlet item id applies
// (a single produced item can legitimately have more than one raw-ingredient
// row, e.g. potatoes + cooking oil both yielding "Chips").
const findYieldRulesForOutletItemIds = (
  outletItemIds: Set<string>,
  rules: ProductionYieldRule[]
): ProductionYieldRule[] => {
  if (!outletItemIds.size) return [];
  return rules.filter((rule) => rule.pos_outlet_item_id && outletItemIds.has(rule.pos_outlet_item_id));
};

const findYieldRulesForSoldItem = (
  soldName: string,
  rules: ProductionYieldRule[]
): ProductionYieldRule[] => {
  const normalizedSold = normalizeItemName(soldName);
  if (!normalizedSold) return [];
  const exact = rules.filter((rule) =>
    normalizeItemName(rule.produced_item_name) === normalizedSold ||
    normalizeItemName(rule.produced_item_sku || '') === normalizedSold
  );
  if (exact.length) return exact;

  // Fuzzy fallback only — names here are unlinked recipes, so substring
  // overlap is ambiguous (e.g. "Chips" matches "Chips + Rice", "Chips
  // Portion" and "Chips Special" all at once). Applying every match would
  // multiply theoretical consumption for that sold item, so keep only the
  // single closest match (smallest difference in normalized name length)
  // instead of summing all of them.
  const candidates = rules.filter((rule) => {
    const normalizedProduced = normalizeItemName(rule.produced_item_name);
    return normalizedProduced.includes(normalizedSold) || normalizedSold.includes(normalizedProduced);
  });
  if (candidates.length <= 1) return candidates;
  const best = candidates.reduce((closest, rule) => {
    const diff = Math.abs(normalizeItemName(rule.produced_item_name).length - normalizedSold.length);
    const closestDiff = Math.abs(normalizeItemName(closest.produced_item_name).length - normalizedSold.length);
    return diff < closestDiff ? rule : closest;
  });
  return [best];
};

const addTheoreticalUsage = (
  map: Record<string, { item_name: string; unit: string; qty: number }>,
  sku: string,
  itemName: string,
  unit: string,
  qty: number
) => {
  if (!sku || !Number.isFinite(qty) || qty <= 0) return;
  const entry = map[sku] || { item_name: itemName || sku, unit: unit || '', qty: 0 };
  entry.qty += qty;
  map[sku] = entry;
};

type UsageBucket = Record<string, { item_name: string; qty: number }>;

const addActualUsage = (
  map: UsageBucket,
  sku: string,
  itemName: string,
  qty: number
) => {
  if (!sku || !Number.isFinite(qty) || qty <= 0) return;
  const entry = map[sku] || { item_name: itemName || sku, qty: 0 };
  entry.qty += qty;
  map[sku] = entry;
};

const shiftAliases = (shift: unknown): string[] => {
  if (shift === 'A') return ['shift_a', 'morning', 'a'];
  if (shift === 'B') return ['shift_b', 'night', 'evening', 'b'];
  return [];
};

const varianceFlag = (varianceQty: number, theoreticalQty: number): 'green' | 'orange' | 'red' => {
  if (theoreticalQty <= 0) return varianceQty > 0 ? 'red' : 'green';
  const pct = Math.abs((varianceQty / theoreticalQty) * 100);
  if (pct <= VARIANCE_TOLERANCE_GREEN_PCT) return 'green';
  if (pct <= VARIANCE_TOLERANCE_ORANGE_PCT) return 'orange';
  return 'red';
};

const isMissingShiftTypeColumn = (error: any): boolean =>
  error?.code === '42703' &&
  String(error?.message || '').toLowerCase().includes('shift_type');

// GET /api/kitchen/daily-control?branch_id=&date=&shift=
// shift is optional: 'A' filters 06:00-18:00, 'B' filters 18:00-06:00 next day.
// When omitted, the full 24-hour day is used (backward compatible).
export const getDailyControlData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, date, shift } = req.query;
    if (!branch_id) {
      throw new AppError('branch_id is required', 400);
    }
    const branchId = Number(branch_id);
    if (!Number.isInteger(branchId)) {
      throw new AppError('branch_id must be an integer', 400);
    }
    const controlDate = (date as string) || new Date().toISOString().split('T')[0];
    const data = await buildDailyControlPayload(branchId, controlDate, (shift as string) || null);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Shared core of Daily Controls — pulled out of the getDailyControlData HTTP
// handler above so the Phase 5 snapshot job (snapshotPreviousClosedCommercialDay
// in cashier-shifts.controller.ts) can compute the exact same payload for a
// previous closed commercial day without an HTTP round-trip. Throws on error
// (no local try/catch) — callers are responsible for handling it.
export async function buildDailyControlPayload(branchId: number, controlDate: string, shift: string | null) {
    // Build time window — full day when shift not specified, half-day otherwise.
    let dayStart: string;
    let dayEnd: string;
    if (shift === 'A') {
      // Morning shift: 06:00 – 18:00 local (stored as UTC offset naive in DB)
      const shiftStart = new Date(`${controlDate}T06:00:00.000Z`);
      const shiftEnd = new Date(`${controlDate}T18:00:00.000Z`);
      dayStart = shiftStart.toISOString();
      dayEnd = shiftEnd.toISOString();
    } else if (shift === 'B') {
      // Evening/night shift: 18:00 – 06:00 next day
      const shiftStart = new Date(`${controlDate}T18:00:00.000Z`);
      const nextDay = new Date(`${controlDate}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const shiftEnd = new Date(nextDay);
      shiftEnd.setUTCHours(6, 0, 0, 0);
      dayStart = shiftStart.toISOString();
      dayEnd = shiftEnd.toISOString();
    } else {
      dayStart = `${controlDate}T00:00:00.000Z`;
      const dayEndDate = new Date(`${controlDate}T00:00:00.000Z`);
      dayEndDate.setUTCDate(dayEndDate.getUTCDate() + 1);
      dayEnd = dayEndDate.toISOString();
    }

    const shiftFilter = shift === 'A' ? 'shift_a' : shift === 'B' ? 'shift_b' : null;

    // Shift team — who to hold accountable for variance on this date/shift.
    // Independent of the formal kitchen_shifts open->close->chef-confirm->
    // accountant-review lifecycle (most shifts never complete it), so this
    // simply reads whichever kitchen_shifts row(s) exist for the date/shift,
    // in any status, rather than requiring one to be fully closed out.
    let shiftTeamQuery = supabase
      .from('kitchen_shifts')
      .select('id, shift_number, status, shift_type, store_keeper_id, assigned_chef_ids')
      .eq('branch_id', branchId)
      .eq('shift_date', controlDate);
    if (shiftFilter) shiftTeamQuery = shiftTeamQuery.eq('shift_type', shiftFilter);
    const { data: matchingShifts } = await shiftTeamQuery;
    const teamUserIds = (matchingShifts || []).flatMap((s: any) => [
      s.store_keeper_id,
      ...((s.assigned_chef_ids || []) as string[])
    ]);
    const shiftTeam = await staffProfileSummaries(teamUserIds);
    const hasKitchenShiftRecord = (matchingShifts || []).length > 0;

    // 1. POS sales for the day/shift — pos_shift_orders is the live source of
    // truth for sales in this system (restaurant_orders/restaurant_order_items
    // exist but are empty in production; all real orders flow through
    // pos_shift_orders.items[], tagged item_group: 'restaurant' for
    // kitchen/food items vs 'bar' for drinks).
    const { data: posOrders, error: posErr } = await supabase
      .from('pos_shift_orders')
      .select('items, status, payment_status, created_at')
      .eq('branch_id', branchId)
      .or('status.in.(paid,credit_bill),payment_status.in.(paid,credit_bill)')
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd);
    if (posErr) throw posErr;

    const soldByItem: Record<string, { qty: number; revenue: number; outletItemIds: Set<string> }> = {};
    (posOrders || []).forEach((order: any) => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (!Array.isArray(items)) return;
      items.forEach((item: any) => {
        if (item.item_group !== 'restaurant') return;
        const name = String(item.name || '').trim();
        if (!name) return;
        const qty = Number(item.quantity || 0);
        const revenue = Number(item.line_total ?? qty * Number(item.unit_price || 0));
        const entry = soldByItem[name] || { qty: 0, revenue: 0, outletItemIds: new Set<string>() };
        entry.qty += qty;
        entry.revenue += revenue;
        if (item.outlet_item_id) entry.outletItemIds.add(String(item.outlet_item_id));
        soldByItem[name] = entry;
      });
    });

    const totalFoodRevenue = Object.values(soldByItem).reduce((sum, e) => sum + e.revenue, 0);
    const totalFoodQtySold = Object.values(soldByItem).reduce((sum, e) => sum + e.qty, 0);

    // 2. Recipes (BOM) — global (branch_id null) or branch-specific, active only.
    const { data: recipesRaw, error: recipeErr } = await supabase
      .from('recipes')
      .select('id, menu_item_name, output_quantity, is_active, branch_id, items:recipe_items(item_sku, item_name, quantity_required, unit)')
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .eq('is_active', true);
    if (recipeErr) throw recipeErr;
    const recipes = (recipesRaw || []) as Array<{
      menu_item_name: string;
      output_quantity: number;
      items: Array<{ item_sku: string; item_name: string; quantity_required: number; unit: string }>;
    }>;
    const productionRules = await loadProductionYieldRules(branchId);

    // 3. Theoretical ingredient consumption = sum over sold menu items of
    // (recipe_items.quantity_required / recipes.output_quantity) * qty_sold.
    // Falls back to the RECIPE_MAP hardcoded table when no DB recipe matches —
    // this ensures Branch 2 (which may not have recipes registered yet) still
    // gets meaningful BOM data from the known menu item → raw ingredient mapping.
    const theoreticalBySku: Record<string, { item_name: string; unit: string; qty: number }> = {};
    const noRecipeItems: Array<{ item_name: string; qty_sold: number }> = [];

    Object.entries(soldByItem).forEach(([itemName, sold]) => {
      // Priority 0: exact POS-menu-item-id link set via Food Control's
      // "Link to POS Menu Item" picker — unambiguous, so it wins over both
      // the legacy recipes table and fuzzy name matching below.
      const idMatchedRules = findYieldRulesForOutletItemIds(sold.outletItemIds, productionRules);
      if (idMatchedRules.length > 0) {
        idMatchedRules.forEach((rule) => {
          addTheoreticalUsage(
            theoreticalBySku,
            rule.raw_item_sku,
            rule.raw_item_name,
            rule.raw_unit,
            sold.qty * (rule.raw_quantity / rule.produced_quantity)
          );
        });
        return;
      }

      const recipe = findRecipeForSoldItem(itemName, recipes);
      if (recipe && recipe.output_quantity > 0 && recipe.items?.length) {
        // Live DB recipe path
        recipe.items.forEach((ri) => {
          const sku = ri.item_sku;
          if (!sku) return;
          const perUnit = Number(ri.quantity_required || 0) / Number(recipe.output_quantity);
          const entry = theoreticalBySku[sku] || { item_name: ri.item_name, unit: ri.unit || '', qty: 0 };
          entry.qty += perUnit * sold.qty;
          theoreticalBySku[sku] = entry;
        });
        return;
      }

      const yieldRules = findYieldRulesForSoldItem(itemName, productionRules);
      if (yieldRules.length > 0) {
        yieldRules.forEach((rule) => {
          addTheoreticalUsage(
            theoreticalBySku,
            rule.raw_item_sku,
            rule.raw_item_name,
            rule.raw_unit,
            sold.qty * (rule.raw_quantity / rule.produced_quantity)
          );
        });
        return;
      }

      // RECIPE_MAP fallback — resolves parent raw ingredients by menu item name
      const mapEntry = RECIPE_MAP[itemName];
      if (mapEntry) {
        const parentSku = mapEntry.parent;
        const entry = theoreticalBySku[parentSku] || { item_name: parentSku, unit: 'kg', qty: 0 };
        entry.qty += sold.qty / mapEntry.yield;
        theoreticalBySku[parentSku] = entry;

        // Multi-parent (Special Pilau / Special Rice also uses RICE; Samosa also uses EXE FLOUR)
        const extras = getParentUsages(itemName, sold.qty).filter(u => u.parent !== mapEntry.parent);
        extras.forEach(u => {
          const e = theoreticalBySku[u.parent] || { item_name: u.parent, unit: 'kg', qty: 0 };
          e.qty += u.amount;
          theoreticalBySku[u.parent] = e;
        });
        return;
      }

      noRecipeItems.push({ item_name: itemName, qty_sold: sold.qty });
    });

    // 4. Actual ingredient consumption — combine every workflow that can issue
    // stock to kitchen. Older deployments use kitchen_session_issues, newer
    // Branch Storekeeper flows issue via kitchen_shifts/kitchen_shift_items,
    // and some branches still record kitchen usage slips directly. Only fall
    // back to stock_history when no direct kitchen issue workflow has data.
    const buildIssuesQuery = (includeShiftType: boolean) => {
      let query = supabase
        .from('kitchen_session_issues')
        .select(
          includeShiftType
            ? 'item_sku, item_name, quantity_issued, session:kitchen_production_sessions!inner(branch_id, session_date, shift_type)'
            : 'item_sku, item_name, quantity_issued, session:kitchen_production_sessions!inner(branch_id, session_date)'
        )
        .eq('session.branch_id', branchId)
        .eq('session.session_date', controlDate);
      if (includeShiftType && shiftFilter) {
        query = query.eq('session.shift_type', shiftFilter);
      }
      return query;
    };

    let { data: issuesRaw, error: issuesErr } = await buildIssuesQuery(true);
    if (issuesErr && isMissingShiftTypeColumn(issuesErr)) {
      ({ data: issuesRaw, error: issuesErr } = await buildIssuesQuery(false));
    }
    if (issuesErr) throw issuesErr;

    const actualBySku: UsageBucket = {};
    const issueSources: Array<{ source: string; rows: number; quantity: number }> = [];
    (issuesRaw || []).forEach((row: any) => {
      addActualUsage(actualBySku, row.item_sku, row.item_name, Number(row.quantity_issued || 0));
    });
    if ((issuesRaw || []).length > 0) {
      issueSources.push({
        source: 'kitchen_session_issues',
        rows: (issuesRaw || []).length,
        quantity: (issuesRaw || []).reduce((sum: number, row: any) => sum + Number(row.quantity_issued || 0), 0)
      });
    }

    const kitchenShiftAliases = shiftAliases(shift);
    try {
      const shiftParams: any[] = [branchId, controlDate];
      let shiftTypeClause = '';
      if (kitchenShiftAliases.length > 0) {
        shiftParams.push(kitchenShiftAliases);
        shiftTypeClause = `AND LOWER(COALESCE(ks.shift_type, '')) = ANY($${shiftParams.length}::text[])`;
      }
      // sold_quantity is the only column that represents ingredient actually
      // confirmed as used in production (incremented by confirmProductionYield
      // in kitchen-shift.controller.ts). opening_stock + additions is merely
      // what was made available to the kitchen that shift, not what was used —
      // summing those would report unused declared stock as "actual" usage.
      const { rows: shiftIssueRows } = await db.query(
        `SELECT
            ksi.item_sku,
            COALESCE(ksi.item_name, si.item_name, ksi.item_sku) AS item_name,
            COALESCE(SUM(COALESCE(ksi.sold_quantity, 0)), 0) AS issued_qty
         FROM public.kitchen_shift_items ksi
         JOIN public.kitchen_shifts ks ON ks.id = ksi.shift_id
         LEFT JOIN public.simple_items si ON si.sku = ksi.item_sku
         WHERE ks.branch_id = $1
           AND ks.shift_date = $2::date
           ${shiftTypeClause}
         GROUP BY ksi.item_sku, COALESCE(ksi.item_name, si.item_name, ksi.item_sku)`,
        shiftParams
      );
      (shiftIssueRows || []).forEach((row: any) => {
        addActualUsage(actualBySku, row.item_sku, row.item_name, Number(row.issued_qty || 0));
      });
      if ((shiftIssueRows || []).length > 0) {
        issueSources.push({
          source: 'kitchen_shift_items',
          rows: shiftIssueRows.length,
          quantity: shiftIssueRows.reduce((sum: number, row: any) => sum + Number(row.issued_qty || 0), 0)
        });
      }
    } catch (err: any) {
      if (!['42P01', '42703'].includes(err?.code)) throw err;
    }

    try {
      const { rows: usageIssueRows } = await db.query(
        `SELECT
            kur.item_sku,
            COALESCE(kur.item_name, si.item_name, kur.item_sku) AS item_name,
            COALESCE(SUM(kur.received_quantity), 0) AS issued_qty
         FROM public.kitchen_usage_records kur
         LEFT JOIN public.simple_items si ON si.sku = kur.item_sku
         WHERE kur.branch_id = $1
           AND kur.usage_date = $2::date
           AND LOWER(COALESCE(kur.status, '')) NOT IN ('cancelled', 'rejected', 'voided')
         GROUP BY kur.item_sku, COALESCE(kur.item_name, si.item_name, kur.item_sku)`,
        [branchId, controlDate]
      );
      (usageIssueRows || []).forEach((row: any) => {
        addActualUsage(actualBySku, row.item_sku, row.item_name, Number(row.issued_qty || 0));
      });
      if ((usageIssueRows || []).length > 0) {
        issueSources.push({
          source: 'kitchen_usage_records',
          rows: usageIssueRows.length,
          quantity: usageIssueRows.reduce((sum: number, row: any) => sum + Number(row.issued_qty || 0), 0)
        });
      }
    } catch (err: any) {
      if (!['42P01', '42703'].includes(err?.code)) throw err;
    }

    // kitchen_shift_pos_consumption — written unconditionally by
    // recordKitchenConsumption() on every POS sale (outlet-pos.controller.ts),
    // unlike kitchen_shift_items.sold_quantity which that same function only
    // updates when a matching opening-stock row already exists for the shift.
    // In practice branches rarely pre-register every raw ingredient into the
    // kitchen shift, so sold_quantity stays orphaned at 0 while this table
    // still captures the real per-sale raw consumption — it is the reliable
    // source for actual usage, not a fallback.
    try {
      const posConsumptionParams: any[] = [branchId, controlDate];
      let posShiftTypeClause = '';
      if (kitchenShiftAliases.length > 0) {
        posConsumptionParams.push(kitchenShiftAliases);
        posShiftTypeClause = `AND LOWER(COALESCE(ks.shift_type, '')) = ANY($${posConsumptionParams.length}::text[])`;
      }
      const { rows: posConsumptionRows } = await db.query(
        `SELECT
            kspc.raw_item_sku AS item_sku,
            COALESCE(kspc.raw_item_name, kspc.raw_item_sku) AS item_name,
            COALESCE(SUM(kspc.raw_quantity_consumed), 0) AS issued_qty
         FROM public.kitchen_shift_pos_consumption kspc
         JOIN public.kitchen_shifts ks ON ks.id = kspc.shift_id
         WHERE ks.branch_id = $1
           AND ks.shift_date = $2::date
           ${posShiftTypeClause}
         GROUP BY kspc.raw_item_sku, COALESCE(kspc.raw_item_name, kspc.raw_item_sku)`,
        posConsumptionParams
      );
      // Only merge rows whose raw_item_sku is an actual tracked raw ingredient
      // (i.e. theoreticalBySku already has a BOM-recipe-driven entry for it).
      // recordKitchenConsumption() writes a row for every POS sale regardless
      // of whether the item has a real Type A raw-ingredient recipe — Type
      // B/C/portion-tracked items end up with raw_item_sku set to their own
      // synthetic per-dish SKU (e.g. "FGH-HBV-0001" for Tea Mug, or a
      // "MENU-<uuid>" placeholder), which has no cost and no theoretical BOM
      // line to reconcile against. Merging those in would just add $0-cost
      // noise rows to the ingredient-level BOM Control table instead of
      // fixing real ingredient variance.
      const matchedPosConsumptionRows = (posConsumptionRows || []).filter(
        (row: any) => theoreticalBySku[row.item_sku]
      );
      matchedPosConsumptionRows.forEach((row: any) => {
        addActualUsage(actualBySku, row.item_sku, row.item_name, Number(row.issued_qty || 0));
      });
      if (matchedPosConsumptionRows.length > 0) {
        issueSources.push({
          source: 'kitchen_shift_pos_consumption',
          rows: matchedPosConsumptionRows.length,
          quantity: matchedPosConsumptionRows.reduce((sum: number, row: any) => sum + Number(row.issued_qty || 0), 0)
        });
      }
    } catch (err: any) {
      if (!['42P01', '42703'].includes(err?.code)) throw err;
    }

    const hasKitchenSession = issueSources.length > 0;

    // When no direct kitchen issue workflow has data for the day, fall back to
    // branch_stock OUT movements so that actual cost is not reported as 0.
    if (!hasKitchenSession && Object.keys(theoreticalBySku).length > 0) {
      const { data: stockOut } = await supabase
        .from('stock_history')
        .select('item_sku, quantity_change, reason')
        .eq('branch_id', branchId)
        .in('reason', ['USAGE', 'KITCHEN_ISSUE', 'DISPATCH', 'OUT'])
        .gte('created_at', dayStart)
        .lt('created_at', dayEnd);
      (stockOut || []).forEach((row: any) => {
        const qty = Math.abs(Number(row.quantity_change || 0));
        addActualUsage(actualBySku, row.item_sku, row.item_sku, qty);
      });
      if ((stockOut || []).length > 0) {
        issueSources.push({
          source: 'stock_history_fallback',
          rows: (stockOut || []).length,
          quantity: (stockOut || []).reduce((sum: number, row: any) => sum + Math.abs(Number(row.quantity_change || 0)), 0)
        });
      }
    }

    // 5. Cost basis — simple_items.cost_price by SKU (the live, populated
    // cost field; recipe_items/kitchen_session_issues do not reliably carry
    // cost data in this schema). For RECIPE_MAP parent items whose SKU is the
    // ingredient name (e.g. "BEEF", "RICE"), also try a case-insensitive item_name
    // lookup so they get priced correctly even without a formal SKU.
    const allSkus = [...new Set([...Object.keys(theoreticalBySku), ...Object.keys(actualBySku)])];
    let costBySku: Record<string, number> = {};
    if (allSkus.length > 0) {
      const lowerNames = allSkus.map((s) => normalizeItemName(s));
      const { rows: costRows } = await db.query(
        `SELECT sku, item_name, cost_price
         FROM public.simple_items
         WHERE sku = ANY($1::text[])
            OR item_name = ANY($1::text[])
            OR LOWER(REGEXP_REPLACE(TRIM(item_name), '[^a-z0-9\\s]', ' ', 'g')) = ANY($2::text[])`,
        [allSkus, lowerNames]
      );
      (costRows || []).forEach((r: any) => {
        const price = Number(r.cost_price || 0);
        if (allSkus.includes(r.sku)) costBySku[r.sku] = price;
        if (allSkus.includes(r.item_name)) costBySku[r.item_name] = price;
        const matchedByName = allSkus.find((sku) => normalizeItemName(sku) === normalizeItemName(r.item_name));
        if (matchedByName) costBySku[matchedByName] = price;
      });
    }

    // 6. LAYER 1 — BOM control rows.
    const bomControl = allSkus.map((sku) => {
      const theoretical = theoreticalBySku[sku];
      const actual = actualBySku[sku];
      const theoreticalQty = theoretical?.qty || 0;
      const actualQty = actual?.qty || 0;
      const unitCost = costBySku[sku] || 0;
      const theoreticalCost = theoreticalQty * unitCost;
      const actualCost = actualQty * unitCost;
      const varianceQty = actualQty - theoreticalQty;
      const varianceCost = actualCost - theoreticalCost;
      const varianceType = varianceQty > 0 ? 'wastage' : varianceQty < 0 ? 'shortage' : 'ok';
      return {
        item_sku: sku,
        item_name: theoretical?.item_name || actual?.item_name || sku,
        unit: theoretical?.unit || '',
        theoretical_qty: Number(theoreticalQty.toFixed(3)),
        actual_qty: Number(actualQty.toFixed(3)),
        unit_cost: unitCost,
        has_cost: unitCost > 0,
        theoretical_cost: Number(theoreticalCost.toFixed(2)),
        actual_cost: Number(actualCost.toFixed(2)),
        variance_qty: Number(varianceQty.toFixed(3)),
        variance_cost: Number(varianceCost.toFixed(2)),
        variance_percent: theoreticalQty > 0 ? Number(((varianceQty / theoreticalQty) * 100).toFixed(1)) : null,
        variance_type: varianceType,
        flag: varianceFlag(varianceQty, theoreticalQty)
      };
    });

    const theoreticalIngredientCost = bomControl.reduce((s, r) => s + r.theoretical_cost, 0);
    const actualIngredientCost = bomControl.reduce((s, r) => s + r.actual_cost, 0);
    const bomVarianceCost = actualIngredientCost - theoreticalIngredientCost;

    // 7. LAYER 2 — Kitchen production vs POS sales, per menu item.
    // Honour shift filter on production entries when specified.
    const buildEntriesQuery = (includeShiftType: boolean) => {
      let query = supabase
        .from('kitchen_production_entries')
        .select(
          includeShiftType
            ? 'menu_item_name, expected_quantity, actual_quantity, session:kitchen_production_sessions!inner(branch_id, session_date, shift_type)'
            : 'menu_item_name, expected_quantity, actual_quantity, session:kitchen_production_sessions!inner(branch_id, session_date)'
        )
        .eq('session.branch_id', branchId)
        .eq('session.session_date', controlDate);
      if (includeShiftType && shiftFilter) {
        query = query.eq('session.shift_type', shiftFilter);
      }
      return query;
    };

    let { data: entriesRaw, error: entriesErr } = await buildEntriesQuery(true);
    if (entriesErr && isMissingShiftTypeColumn(entriesErr)) {
      ({ data: entriesRaw, error: entriesErr } = await buildEntriesQuery(false));
    }
    if (entriesErr) throw entriesErr;

    const producedByItem: Record<string, number> = {};
    (entriesRaw || []).forEach((row: any) => {
      const name = String(row.menu_item_name || '').trim();
      if (!name) return;
      const produced = Number(row.actual_quantity || 0) > 0 ? Number(row.actual_quantity) : Number(row.expected_quantity || 0);
      producedByItem[name] = (producedByItem[name] || 0) + produced;
    });

    try {
      const productionAliases = shiftAliases(shift);
      const productionParams: any[] = [branchId, controlDate];
      let productionShiftClause = '';
      if (productionAliases.length > 0) {
        productionParams.push(productionAliases);
        productionShiftClause = `AND LOWER(COALESCE(ks.shift_type, '')) = ANY($${productionParams.length}::text[])`;
      }
      const { rows: shiftProductionRows } = await db.query(
        `SELECT
            ksp.produced_item_name,
            COALESCE(SUM(ksp.produced_quantity), 0) AS produced_qty
         FROM public.kitchen_shift_production ksp
         JOIN public.kitchen_shifts ks ON ks.id = ksp.shift_id
         WHERE ks.branch_id = $1
           AND ks.shift_date = $2::date
           ${productionShiftClause}
         GROUP BY ksp.produced_item_name`,
        productionParams
      );
      (shiftProductionRows || []).forEach((row: any) => {
        const name = String(row.produced_item_name || '').trim();
        if (!name) return;
        const produced = Number(row.produced_qty || 0);
        producedByItem[name] = (producedByItem[name] || 0) + produced;
      });
    } catch (err: any) {
      if (!['42P01', '42703'].includes(err?.code)) throw err;
    }

    const kitchenVsSalesNames = [...new Set([...Object.keys(producedByItem), ...Object.keys(soldByItem)])];
    const kitchenVsSales = kitchenVsSalesNames.map((name) => {
      const produced = producedByItem[name] || 0;
      const sold = soldByItem[name]?.qty || 0;
      const variance = produced - sold;
      return {
        item_name: name,
        produced_qty: Number(produced.toFixed(2)),
        sold_qty: Number(sold.toFixed(2)),
        variance: Number(variance.toFixed(2)),
        status: variance > 0 ? 'overproduction' : variance < 0 ? 'underproduction' : 'balanced'
      };
    });

    // 8. LAYER 3 — Stock issued cost vs food revenue.
    const { data: branchRow } = await supabase
      .from('branches')
      .select('metadata')
      .eq('id', branchId)
      .maybeSingle();
    const configuredTarget = Number(
      (branchRow?.metadata as any)?.settings?.food_cost_target_percent
    );
    const targetPercent = Number.isFinite(configuredTarget) && configuredTarget > 0
      ? configuredTarget
      : DEFAULT_FOOD_COST_TARGET_PERCENT;

    const foodCostPercent = totalFoodRevenue > 0
      ? Number(((actualIngredientCost / totalFoodRevenue) * 100).toFixed(1))
      : null;

    const stockVsSales = {
      stock_issued_cost: Number(actualIngredientCost.toFixed(2)),
      food_revenue: Number(totalFoodRevenue.toFixed(2)),
      food_cost_percent: foodCostPercent,
      target_percent: targetPercent,
      exceeds_target: foodCostPercent !== null && foodCostPercent > targetPercent
    };

    // Build Parent-Child Sales Map
    const parentChildMap: Record<string, { parent_name: string; children: Record<string, any> }> = {};

    const getOrCreateParent = (sku: string, name: string) => {
      if (!parentChildMap[sku]) {
        parentChildMap[sku] = {
          parent_name: name,
          children: {}
        };
      }
      return parentChildMap[sku];
    };

    // 1. Process Yield Splits / Production Rules
    productionRules.forEach(rule => {
      if (!rule.raw_item_sku) return;
      const parent = getOrCreateParent(rule.raw_item_sku, rule.raw_item_name);
      
      const childName = rule.produced_item_name;
      const sold = soldByItem[childName];
      const soldQty = sold ? sold.qty : 0;
      const rawQtyUsed = soldQty * (Number(rule.raw_quantity || 0) / Number(rule.produced_quantity || 1));

      if (!parent.children[childName]) {
        parent.children[childName] = {
          child_name: childName,
          sold_qty: 0,
          raw_qty_used: 0,
          unit: rule.produced_unit || 'Portion',
          raw_unit: rule.raw_unit || 'KG'
        };
      }
      parent.children[childName].sold_qty += soldQty;
      parent.children[childName].raw_qty_used += rawQtyUsed;
    });

    // 2. Process Recipes (BOMs)
    recipes.forEach(recipe => {
      const childName = recipe.menu_item_name;
      const sold = soldByItem[childName];
      const soldQty = sold ? sold.qty : 0;

      recipe.items.forEach(ri => {
        if (!ri.item_sku) return;
        const parent = getOrCreateParent(ri.item_sku, ri.item_name);
        const rawQtyUsed = soldQty * (Number(ri.quantity_required || 0) / Number(recipe.output_quantity || 1));

        if (!parent.children[childName]) {
          parent.children[childName] = {
            child_name: childName,
            sold_qty: 0,
            raw_qty_used: 0,
            unit: 'Portion',
            raw_unit: ri.unit || 'KG'
          };
        }
        parent.children[childName].sold_qty += soldQty;
        parent.children[childName].raw_qty_used += rawQtyUsed;
      });
    });

    // 3. Fallback: RECIPE_MAP
    Object.entries(soldByItem).forEach(([childName, sold]) => {
      const mapEntry = RECIPE_MAP[childName];
      if (mapEntry) {
        const parentSku = mapEntry.parent;
        const parent = getOrCreateParent(parentSku, parentSku);
        const rawQtyUsed = sold.qty / mapEntry.yield;

        if (!parent.children[childName]) {
          parent.children[childName] = {
            child_name: childName,
            sold_qty: 0,
            raw_qty_used: 0,
            unit: 'Portion',
            raw_unit: 'KG'
          };
        }
        parent.children[childName].sold_qty += sold.qty;
        parent.children[childName].raw_qty_used += rawQtyUsed;

        const extras = getParentUsages(childName, sold.qty).filter(u => u.parent !== mapEntry.parent);
        extras.forEach(u => {
          const extParent = getOrCreateParent(u.parent, u.parent);
          if (!extParent.children[childName]) {
            extParent.children[childName] = {
              child_name: childName,
              sold_qty: 0,
              raw_qty_used: 0,
              unit: 'Portion',
              raw_unit: 'KG'
            };
          }
          extParent.children[childName].sold_qty += sold.qty;
          extParent.children[childName].raw_qty_used += u.amount;
        });
      }
    });

    const parentChildSales = Object.entries(parentChildMap).map(([sku, data]) => {
      const childrenArray = Object.values(data.children)
        .map(child => ({
          child_name: child.child_name,
          sold_qty: Number(child.sold_qty.toFixed(3)),
          raw_qty_used: Number(child.raw_qty_used.toFixed(3)),
          unit: child.unit,
          raw_unit: child.raw_unit
        }));
      
      const totalRaw = childrenArray.reduce((sum, child) => sum + child.raw_qty_used, 0);

      return {
        parent_sku: sku,
        parent_name: data.parent_name,
        children: childrenArray,
        total_raw_sold: Number(totalRaw.toFixed(3))
      };
    }).filter(p => p.children.length > 0);

    const topVarianceItems = [...bomControl]
      .sort((a, b) => Math.abs(b.variance_cost) - Math.abs(a.variance_cost))
      .slice(0, 5);

    return {
        branch_id: branchId,
        date: controlDate,
        shift: shift || null,
        has_kitchen_session: hasKitchenSession,
        has_kitchen_issue_tracking: hasKitchenSession,
        has_kitchen_shift_record: hasKitchenShiftRecord,
        shift_team: shiftTeam,
        issue_sources: issueSources,
        kitchen_issue_summary: {
          total_issue_rows: issueSources.reduce((sum, source) => sum + source.rows, 0),
          total_issued_qty: Number(issueSources.reduce((sum, source) => sum + source.quantity, 0).toFixed(3)),
          sources: issueSources.map((source) => source.source)
        },
        bom_control: bomControl,
        no_recipe_items: noRecipeItems,
        kitchen_vs_sales: kitchenVsSales,
        parent_child_sales: parentChildSales,
        stock_vs_sales: stockVsSales,
        summary: {
          total_food_qty_sold: Number(totalFoodQtySold.toFixed(2)),
          total_food_revenue: Number(totalFoodRevenue.toFixed(2)),
          theoretical_ingredient_cost: Number(theoreticalIngredientCost.toFixed(2)),
          actual_ingredient_cost: Number(actualIngredientCost.toFixed(2)),
          bom_variance_cost: Number(bomVarianceCost.toFixed(2)),
          bom_variance_percent: theoreticalIngredientCost > 0
            ? Number(((bomVarianceCost / theoreticalIngredientCost) * 100).toFixed(1))
            : null,
          food_cost_percent: foodCostPercent,
          target_food_cost_percent: targetPercent,
          top_variance_items: topVarianceItems
        }
    };
}

// GET /api/kitchen/daily-control/snapshot (Phase 5)
// The finalized "previous closed commercial day" view — the most recent
// daily_control_snapshots row for this branch, frozen by
// snapshotPreviousClosedCommercialDay (cashier-shifts.controller.ts) when the
// next cashier shift opened. Distinct from getDailyControlData above, which
// is always a live/provisional computation — the Daily Controls screen must
// show both, clearly labeled, never merged.
export const getDailyControlSnapshot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id } = req.query;
    if (!branch_id) {
      throw new AppError('branch_id is required', 400);
    }
    const branchId = Number(branch_id);
    if (!Number.isInteger(branchId)) {
      throw new AppError('branch_id must be an integer', 400);
    }
    const { data, error } = await supabase
      .from('daily_control_snapshots')
      .select('*')
      .eq('branch_id', branchId)
      .order('shift_date', { ascending: false })
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.status(200).json({ success: true, data: data || null });
  } catch (error) {
    next(error);
  }
};

// GET /api/kitchen/daily-control/stock-ledger
// The physical stock ledger view (Opening/Added/Totals/Closing/Rejects/
// Quantity Sold/System Sold/Shorts) matching the paper ledger branches
// already use. Every column except Closing Stock is read straight off
// kitchen_shift_items — opening_stock, additions and spoilage_quantity are
// written by addShiftStock/recordSpoilage, sold_quantity by
// recordKitchenConsumption (POS sale) and confirmProductionActual (recipe
// yield confirm), physical_count by closeKitchenShift (the manual physical
// count, the ONLY manual entry anywhere in this view). No separate ledger
// table or duplicate entry field — this is a read-only reshaping of data
// that already exists for an entirely different reason (kitchen shift
// reconciliation), now exposed in the storekeeper's own paper-ledger shape.
//
// A calendar day can span more than one kitchen_shifts row (Shift A then
// Shift B, or several ad-hoc shifts) for the same stock item — Shift B's
// opening_stock is seeded from Shift A's closing handover (see
// kitchen_shift_handovers), so summing them naively would double count.
// Per item, across every matching shift ordered by opened_at: Opening Stock
// is the EARLIEST shift's opening_stock, Added/Rejects/System Sold are
// SUMMED across shifts, and Closing Stock is the LATEST shift's
// physical_count (null if that shift hasn't been physically closed yet).
// The physical stock ledger this branch actually fills in daily is "Kitchen
// Stocktake" (kitchen_stocktake_shifts/items, storekeeping module) — a fixed
// 19-dish catalog submitted ~twice a day. The separate "Kitchen Sessions"
// lifecycle (kitchen_shifts/kitchen_shift_items, closeKitchenShift) is never
// actually closed by this branch's staff (every row stays status: 'open'),
// so it can never supply a real Closing Stock figure. Kitchen Stocktake's
// closing_qty is real, submitted data, and it already computes Rejects
// (approved branch_spoilage_log) and Sold (real restaurant_order_items POS
// sales) the same way the storekeeper sees when they submit — so the ledger
// reuses those exact same helpers rather than re-deriving its own numbers.
export const getStockLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, date, shift } = req.query;
    if (!branch_id) throw new AppError('branch_id is required', 400);
    if (!date) throw new AppError('date is required', 400);
    const branchId = Number(branch_id);
    if (!Number.isInteger(branchId)) throw new AppError('branch_id must be an integer', 400);
    const stocktakeDate = String(date);

    const shiftFilter = (() => {
      const s = `${shift || ''}`.toUpperCase();
      if (s === 'A') return ['A'];
      if (s === 'B') return ['B'];
      return ['A', 'B'];
    })();

    const { data: shiftRows, error: shiftErr } = await supabase
      .from('kitchen_stocktake_shifts')
      .select('id, shift, status, submitted_at, items:kitchen_stocktake_items(item_name, opening_qty, added_qty, closing_qty)')
      .eq('branch_id', branchId)
      .eq('stocktake_date', stocktakeDate)
      .in('shift', shiftFilter);
    if (shiftErr) throw shiftErr;

    // Only a submitted (or later) shift has a finalized closing count —
    // a saved-but-unsubmitted draft has progress but isn't a real handover.
    const finalizedShifts = ((shiftRows || []) as any[])
      .filter((s) => s.status && s.status !== 'draft')
      .sort((a, b) => (a.shift > b.shift ? 1 : -1)); // A before B

    const { data: invItems } = await supabase
      .from('inventory_items')
      .select('item_name, unit')
      .in('item_name', KITCHEN_STOCKTAKE_ITEMS);
    const unitByName = new Map<string, string>(
      ((invItems || []) as any[]).map((i) => [i.item_name, i.unit || 'portion'])
    );

    // "All day" sold uses the calendar-day query (shift submission
    // timestamps are frequently backfilled and don't reliably split sales
    // by shift — see getKitchenSoldByNameForDay); a single-shift filter
    // keeps the shift-scoped query since that's the only signal available
    // for "this shift only".
    const [spoilageByShift, soldByName] = await Promise.all([
      Promise.all(finalizedShifts.map((s) =>
        getApprovedKitchenSpoilageByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, s.shift)
      )),
      shiftFilter.length === 2
        ? getKitchenSoldByNameForDay(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate)
        : finalizedShifts.length === 1
          ? getKitchenSoldByName(branchId, KITCHEN_STOCKTAKE_ITEMS, stocktakeDate, finalizedShifts[0].shift)
          : Promise.resolve(new Map<string, number>()),
    ]);

    // Full-day view is only "complete" once Shift B has been submitted —
    // otherwise the day's real closing count hasn't been taken yet.
    const dayIsComplete = shiftFilter.length === 1
      ? finalizedShifts.length === 1
      : finalizedShifts.some((s) => s.shift === 'B');

    const shiftAliasesForShifts = shiftFilter.map(s => {
      if (s === 'A') return 'shift_a';
      if (s === 'B') return 'shift_b';
      return s;
    });
    if (shiftAliasesForShifts.includes('shift_a')) {
      shiftAliasesForShifts.push('a', 'morning');
    }
    if (shiftAliasesForShifts.includes('shift_b')) {
      shiftAliasesForShifts.push('b', 'evening', 'night');
    }

    const { rows: shiftItemsRaw } = await db.query(
      `SELECT ksi.item_sku,
              ksi.item_name,
              COALESCE(SUM(COALESCE(ksi.opening_stock, 0)), 0)::numeric AS opening,
              COALESCE(SUM(COALESCE(ksi.additions, 0)), 0)::numeric AS added
         FROM kitchen_shift_items ksi
         JOIN kitchen_shifts ks ON ks.id = ksi.shift_id
        WHERE ks.branch_id = $1 AND ks.shift_date = $2::date
          AND LOWER(COALESCE(ks.shift_type, '')) = ANY($3::text[])
        GROUP BY ksi.item_sku, ksi.item_name`,
      [branchId, stocktakeDate, shiftAliasesForShifts]
    );

    const MAP_SHIFT_ITEM_TO_STOCKTAKE: Record<string, string> = {
      'FG-16': 'Sausages',
      'FG-149': 'Mbuzi Raw',
      'FG-15': 'Chicken B',
      'FG-18': 'Fish',
      'FG-3': 'Chapati',
      'FG-14': 'Mandazi',
      'FG-106': 'Milk',
      'FG-5': 'Rice',
      'FG-80': 'Beef',
      'FG-86': 'Chips',
      'FG-51': 'Eggs B',
      'FG-52': 'Pilau',
    };

    const mapShiftItemToStocktake = (sku: string, name: string): string => {
      const s = String(sku || '').toUpperCase();
      const n = String(name || '').toUpperCase();
      if (MAP_SHIFT_ITEM_TO_STOCKTAKE[s]) {
        return MAP_SHIFT_ITEM_TO_STOCKTAKE[s];
      }
      if (s === 'FG-16' || n.includes('SAUSAGE')) return 'Sausages';
      if (s === 'FG-149' || n.includes('MBUZI')) return 'Mbuzi Raw';
      if (s === 'FG-15' || n.includes('BROILER')) return 'Chicken B';
      if (s === 'FG-18' || n.includes('FISH')) return 'Fish';
      if (s === 'FG-3' || n.includes('EXE ALL PURPOSE')) return 'Chapati';
      if (s === 'FG-14' || n.includes('SELFRAISING') || n.includes('NDAZI') || n.includes('MANDAZI')) return 'Mandazi';
      if (s === 'FG-106' || n.includes('MILK')) return 'Milk';
      if (s === 'FG-5' || n.includes('RICE')) return 'Rice';
      if (s === 'FG-80' || n.includes('BEEF')) return 'Beef';
      if (s === 'FG-86' || n.includes('POTATO')) return 'Chips';
      if (s === 'FG-51' || n.includes('EGG')) return 'Eggs B';
      for (const item of KITCHEN_STOCKTAKE_ITEMS) {
        const itemUpper = item.toUpperCase();
        if (itemUpper === n || n.includes(itemUpper) || itemUpper.includes(n)) {
          return item;
        }
      }
      return name;
    };

    const shiftOpeningMap = new Map<string, number>();
    const shiftAddedMap = new Map<string, number>();

    (shiftItemsRaw || []).forEach((row: any) => {
      const stocktakeName = mapShiftItemToStocktake(row.item_sku, row.item_name);
      shiftOpeningMap.set(stocktakeName, (shiftOpeningMap.get(stocktakeName) ?? 0) + Number(row.opening));
      shiftAddedMap.set(stocktakeName, (shiftAddedMap.get(stocktakeName) ?? 0) + Number(row.added));
    });

    // The stocktake rows carry their own opening/added — the storekeeper's
    // primary daily record. On most days kitchen_shift_items has NO rows at
    // all, which used to collapse opening/added to 0 while closing stayed
    // real, producing a negative "sold" and a fake positive short. Day
    // aggregation: opening from the EARLIEST finalized shift, added summed
    // across shifts (closing already comes from the latest shift below).
    const stOpeningMap = new Map<string, number>();
    const stAddedMap = new Map<string, number>();
    finalizedShifts.forEach((s) => {
      ((s.items || []) as any[]).forEach((i: any) => {
        if (!stOpeningMap.has(i.item_name)) {
          stOpeningMap.set(i.item_name, Number(i.opening_qty || 0));
        }
        stAddedMap.set(i.item_name, (stAddedMap.get(i.item_name) ?? 0) + Number(i.added_qty || 0));
      });
    });

    const data = KITCHEN_STOCKTAKE_ITEMS.map((name) => {
      // Prefer the stocktake's own figures; fall back to the kitchen shift
      // workflow only when the stocktake recorded no movement for the item.
      const stOpening = stOpeningMap.get(name) ?? 0;
      const stAdded = stAddedMap.get(name) ?? 0;
      const useStocktake = stOpening !== 0 || stAdded !== 0;
      const opening = useStocktake ? stOpening : (shiftOpeningMap.get(name) ?? 0);
      const added = useStocktake ? stAdded : (shiftAddedMap.get(name) ?? 0);
      let rejects = 0;
      let closing: number | null = null;

      finalizedShifts.forEach((s, idx) => {
        const row = ((s.items || []) as any[]).find((i) => i.item_name === name);
        if (!row) return;
        rejects += spoilageByShift[idx].get(name) ?? 0;
        // finalizedShifts is sorted A then B, so B's closing (the later,
        // more complete shift) overwrites A's when both are present.
        closing = Number(row.closing_qty || 0);
      });
      const systemSold = soldByName.get(name) ?? 0;

      const totals = opening + added;
      const hasClosing = dayIsComplete && closing !== null;
      let quantitySold = hasClosing ? totals - closing! - rejects : null;
      let shorts = hasClosing ? Number(systemSold - (quantitySold as number)) : null;

      let dataQuality: 'OK' | 'PENDING_HANDOVER' | 'NO_MOVEMENT' | 'INCOMPLETE_OPENING';
      if (!hasClosing) {
        dataQuality = 'PENDING_HANDOVER';
      } else if (quantitySold !== null && quantitySold < 0) {
        // Physically impossible: closing exceeds opening + added. Opening/
        // added were not recorded for this item — flag it instead of showing
        // a negative sold quantity and a fake positive short.
        dataQuality = 'INCOMPLETE_OPENING';
        quantitySold = null;
        shorts = null;
      } else if (opening === 0 && added === 0 && rejects === 0 && systemSold === 0 && totals === closing) {
        dataQuality = 'NO_MOVEMENT';
      } else {
        dataQuality = 'OK';
      }

      return {
        item_sku: name,
        item_name: name,
        unit: unitByName.get(name) || 'portion',
        opening_stock: Number(opening.toFixed(3)),
        added_stock: Number(added.toFixed(3)),
        totals: Number(totals.toFixed(3)),
        closing_stock: hasClosing ? Number(closing!.toFixed(3)) : null,
        rejects: Number(rejects.toFixed(3)),
        quantity_sold: quantitySold !== null ? Number(quantitySold.toFixed(3)) : null,
        system_sold: Number(systemSold.toFixed(3)),
        shorts: shorts !== null ? Number(shorts.toFixed(3)) : null,
        data_quality: dataQuality
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/kitchen/daily-control/bill-staff
// Branch Accountant action: charge the staff responsible for a Daily Control
// variance line (a bom_control row from getDailyControlData above —
// recipe-based theoretical vs actual ingredient consumption for a given
// branch/date/shift). Deliberately independent of the kitchen_shifts
// open->close->chef-confirm->accountant-review lifecycle (see
// accountantReviewShift in kitchen-shift.controller.ts for that parallel,
// lifecycle-gated liability flow) — in practice almost no shift ever
// completes that lifecycle, while Daily Control computes real variance from
// actual sales every day regardless, so this lets the accountant act
// directly on it.
export const billDailyControlVariance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      branch_id, date, shift, item_name, item_sku, variance_cost,
      liability_action, allocations, notes, write_off_reason
    } = req.body;

    if (!branch_id || !date || !item_name) {
      throw new AppError('branch_id, date, and item_name are required', 400);
    }
    const branchId = Number(branch_id);
    if (!Number.isInteger(branchId)) {
      throw new AppError('branch_id must be an integer', 400);
    }

    const action = liability_action || 'approve_only';
    if (action === 'write_off' && !String(write_off_reason || notes || '').trim()) {
      throw new AppError('Write-off reason is required', 400);
    }

    const normalizedAllocations = Array.isArray(allocations) ? allocations : [];
    if (action !== 'write_off' && action !== 'approve_only' && normalizedAllocations.length === 0) {
      throw new AppError('At least one staff allocation is required for this liability action', 400);
    }

    const userId = (req as any).user?.id;
    const creditBills: any[] = [];

    if (action !== 'write_off' && action !== 'approve_only') {
      for (const allocation of normalizedAllocations) {
        const amount = Math.abs(Number(allocation.amount || 0));
        if (amount <= 0) continue;
        const staffId = await resolveStaffProfileId(
          allocation.staff_profile_id || allocation.staff_id || allocation.user_id
        );
        if (!staffId) continue;
        const { data: bill, error: billError } = await supabase
          .from('staff_credit_bills')
          .insert({
            staff_id: staffId,
            branch_id: branchId,
            amount,
            balance: amount,
            paid_amount: 0,
            description: allocation.description ||
              `Kitchen variance — ${item_name} (${date}${shift ? ` shift ${shift}` : ''})`,
            bill_date: date,
            status: 'accountant_confirmed',
            approved_at: new Date().toISOString(),
            approved_by: userId
          })
          .select()
          .maybeSingle();
        if (billError) throw new AppError(billError.message, 500);
        if (bill) creditBills.push(bill);
      }
      if (creditBills.length === 0) {
        throw new AppError('No valid staff allocation resolved to a billable staff profile', 400);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        branch_id: branchId,
        date,
        shift: shift || null,
        item_name,
        item_sku: item_sku || null,
        variance_cost: variance_cost != null ? Number(variance_cost) : null,
        liability_action: action,
        credit_bills: creditBills
      }
    });
  } catch (error) {
    next(error);
  }
};
