import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { AppError } from '../../middleware/errorHandler';
import db from '../../db';

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
  return rules.filter((rule) => {
    const normalizedProduced = normalizeItemName(rule.produced_item_name);
    return normalizedProduced.includes(normalizedSold) || normalizedSold.includes(normalizedProduced);
  });
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

    const soldByItem: Record<string, { qty: number; revenue: number }> = {};
    (posOrders || []).forEach((order: any) => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (!Array.isArray(items)) return;
      items.forEach((item: any) => {
        if (item.item_group !== 'restaurant') return;
        const name = String(item.name || '').trim();
        if (!name) return;
        const qty = Number(item.quantity || 0);
        const revenue = Number(item.line_total ?? qty * Number(item.unit_price || 0));
        const entry = soldByItem[name] || { qty: 0, revenue: 0 };
        entry.qty += qty;
        entry.revenue += revenue;
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
      const { rows: shiftIssueRows } = await db.query(
        `SELECT
            ksi.item_sku,
            COALESCE(ksi.item_name, si.item_name, ksi.item_sku) AS item_name,
            COALESCE(SUM(COALESCE(ksi.opening_stock, 0) + COALESCE(ksi.additions, 0)), 0) AS issued_qty
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

    // 9. LAYER 4 — Summary + top variance items.
    const topVarianceItems = [...bomControl]
      .sort((a, b) => Math.abs(b.variance_cost) - Math.abs(a.variance_cost))
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        branch_id: branchId,
        date: controlDate,
        shift: shift || null,
        has_kitchen_session: hasKitchenSession,
        has_kitchen_issue_tracking: hasKitchenSession,
        issue_sources: issueSources,
        kitchen_issue_summary: {
          total_issue_rows: issueSources.reduce((sum, source) => sum + source.rows, 0),
          total_issued_qty: Number(issueSources.reduce((sum, source) => sum + source.quantity, 0).toFixed(3)),
          sources: issueSources.map((source) => source.source)
        },
        bom_control: bomControl,
        no_recipe_items: noRecipeItems,
        kitchen_vs_sales: kitchenVsSales,
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
      }
    });
  } catch (error) {
    next(error);
  }
};
