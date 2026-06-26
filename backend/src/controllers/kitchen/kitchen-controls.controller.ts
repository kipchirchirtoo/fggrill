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
    
    // First, fetch kitchen sessions for this branch, date, shift_type
    const { data: kitchenSessions, error: ksErr } = await supabase
      .from('kitchen_production_sessions')
      .select('id, session_number, status, closing_stock:kitchen_session_closing_stock(*), issues:kitchen_session_issues(*)')
      .eq('branch_id', branch_id)
      .eq('session_date', shift_date)
      .eq('shift_type', shift_type);

    if (ksErr) throw ksErr;

    // Actual usage logic: Opening stock is tracked where? 
    // Usually kitchen sessions don't explicitly store opening stock unless it's in kitchen_session_issues or from the previous closing stock.
    // However, the prompt says "KITCHEN ADDDITIONSS ARE TRACKED AS PER THE KITCHEN SHIFT THEY ARE A OR B AND ARE TRACKED AS ITEMSS GIVEN TO KITCHEN"
    // So "kitchen_session_issues" = items given to kitchen.
    // Let's sum up the items given to kitchen during this session.
    const actualUsageMap: Record<string, number> = {};

    let kitchen_session_id = null;
    
    if (kitchenSessions && kitchenSessions.length > 0) {
      kitchen_session_id = kitchenSessions[0].id;
      // Add up issues (additions to kitchen)
      kitchenSessions.forEach(session => {
        session.issues?.forEach((issue: { item_name: string; quantity: number }) => {
          const parent = issue.item_name;
          actualUsageMap[parent] = (actualUsageMap[parent] || 0) + Number(issue.quantity || 0);
        });
        
        // Subtract closing stock (what was left over)
        session.closing_stock?.forEach((closing: { item_name: string; actual_quantity?: number; expected_quantity?: number }) => {
           const parent = closing.item_name;
           actualUsageMap[parent] = (actualUsageMap[parent] || 0) - Number(closing.actual_quantity || closing.expected_quantity || 0);
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

    // 3. Aggregate Sold Items
    const expectedUsageMap: Record<string, number> = {};
    const itemSales: Record<string, number> = {};

    posOrders?.forEach(order => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (Array.isArray(items)) {
        items.forEach((item: { name: string; quantity: number }) => {
          const qty = Number(item.quantity || 1);
          itemSales[item.name] = (itemSales[item.name] || 0) + qty;
          
          const usages = getParentUsages(item.name, qty);
          usages.forEach(u => {
            expectedUsageMap[u.parent] = (expectedUsageMap[u.parent] || 0) + u.amount;
          });
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
