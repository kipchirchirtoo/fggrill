import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

type OutletType = 'restaurant' | 'main_bar' | 'executive_bar' | 'non_consumables' | 'cashier';
type PaymentMethod = 'cash' | 'mpesa' | 'card' | 'credit_bill';

const GLOBAL_ROLES = new Set([
  'super_admin',
  'general_manager',
  'director',
  'auditor',
  'finance_manager',
  'accountant',
  'branch_accountant'
]);

const REVIEW_ROLES = new Set([
  'super_admin',
  'general_manager',
  'director',
  'auditor',
  'finance_manager',
  'accountant',
  'branch_accountant',
  'branch_manager'
]);

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const branchIdFor = (req: Request): number | null => {
  const raw = req.user?.branch_id ?? req.user?.branchId ?? req.query.branch_id;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const roleFor = (req: Request): string => String(req.user?.role ?? '').toLowerCase();

const isGlobalUser = (req: Request): boolean => GLOBAL_ROLES.has(roleFor(req));

const assertUser = (req: Request): void => {
  if (!req.user?.id) {
    throw new AppError('Authentication required', 401);
  }
};

const loadShift = async (shiftId: string) => {
  const { data, error } = await supabase
    .from('pos_outlet_shifts')
    .select('*, outlet:pos_outlets(*)')
    .eq('id', shiftId)
    .single();

  if (error || !data) {
    throw new AppError('POS shift not found', 404);
  }
  return data as Record<string, any>;
};

const ensureBranchAccess = (req: Request, branchId: unknown): void => {
  if (isGlobalUser(req)) return;
  const reqBranchId = branchIdFor(req);
  if (!reqBranchId || Number(branchId) !== reqBranchId) {
    throw new AppError('Forbidden: outlet belongs to another branch', 403);
  }
};

const ensureShiftAccess = async (req: Request, shiftId: string) => {
  const shift = await loadShift(shiftId);
  ensureBranchAccess(req, shift.branch_id);
  return shift;
};

const calculateShiftSummary = async (shiftId: string) => {
  const [{ data: payments, error: paymentsError }, { data: counts, error: countsError }] = await Promise.all([
    supabase.from('pos_shift_payments').select('*').eq('shift_id', shiftId),
    supabase.from('pos_shift_stock_counts').select('*').eq('shift_id', shiftId)
  ]);

  if (paymentsError) throw paymentsError;
  if (countsError) throw countsError;

  const paymentRows = (payments || []) as Array<Record<string, any>>;
  const countRows = (counts || []) as Array<Record<string, any>>;
  const salesByMethod = paymentRows.reduce<Record<PaymentMethod, number>>(
    (acc, row) => {
      const method = String(row.payment_method || 'cash').toLowerCase() as PaymentMethod;
      if (acc[method] !== undefined) {
        acc[method] += numberValue(row.amount);
      }
      return acc;
    },
    { cash: 0, mpesa: 0, card: 0, credit_bill: 0 }
  );

  const totalSales = Object.values(salesByMethod).reduce((sum, value) => sum + value, 0);
  const totalCogs = countRows.reduce(
    (sum, row) => sum + numberValue(row.sold_quantity) * numberValue(row.cost_price),
    0
  );
  const grossProfit = totalSales - totalCogs;
  const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

  return {
    total_sales: totalSales,
    total_cost_of_goods_sold: totalCogs,
    gross_profit: grossProfit,
    profit_margin: profitMargin,
    sales_by_method: salesByMethod,
    items_sold: countRows.reduce((sum, row) => sum + numberValue(row.sold_quantity), 0),
    generated_at: new Date().toISOString()
  };
};

const updateStockForItems = async (
  shiftId: string,
  outletId: string,
  items: Array<Record<string, any>>,
  direction: 1 | -1
): Promise<void> => {
  for (const item of items) {
    const outletItemId = String(item.outlet_item_id ?? item.product_id ?? item.id ?? '');
    const quantity = numberValue(item.qty ?? item.quantity);
    if (!outletItemId || quantity <= 0) continue;

    const { data: countRow, error: countError } = await supabase
      .from('pos_shift_stock_counts')
      .select('*')
      .eq('shift_id', shiftId)
      .eq('outlet_item_id', outletItemId)
      .maybeSingle();

    if (countError) throw countError;
    if (!countRow) continue;

    const soldQuantity = Math.max(0, numberValue(countRow.sold_quantity) + direction * quantity);
    const systemClosingStock =
      numberValue(countRow.opening_stock) + numberValue(countRow.additions) - soldQuantity;

    const { error: updateCountError } = await supabase
      .from('pos_shift_stock_counts')
      .update({
        sold_quantity: soldQuantity,
        system_closing_stock: systemClosingStock,
        variance:
          countRow.physical_count === null || countRow.physical_count === undefined
            ? 0
            : numberValue(countRow.physical_count) - systemClosingStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', countRow.id);

    if (updateCountError) throw updateCountError;

    const { data: outletItem, error: itemError } = await supabase
      .from('pos_outlet_items')
      .select('current_stock')
      .eq('id', outletItemId)
      .eq('outlet_id', outletId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!outletItem) continue;

    await supabase
      .from('pos_outlet_items')
      .update({
        current_stock: numberValue(outletItem.current_stock) - direction * quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', outletItemId);
  }
};

const seedOutletItemsFromExistingMenus = async (
  outlet: Record<string, any>
): Promise<Array<Record<string, any>>> => {
  const outletType = String(outlet.outlet_type || '');
  const branchId = outlet.branch_id;
  let sourceRows: Array<Record<string, any>> = [];

  if (outletType === 'restaurant') {
    let query = supabase
      .from('restaurant_menu_items')
      .select('id, name, price, category, is_available, branch_id')
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data, error } = await query;
    if (error) throw error;
    sourceRows = ((data || []) as Array<Record<string, any>>).map((item) => ({
      outlet_id: outlet.id,
      source_table: 'restaurant_menu_items',
      source_item_id: item.id,
      sku: `R-${item.id}`,
      name: item.name,
      category: item.category || 'Restaurant',
      unit: 'each',
      cost_price: 0,
      selling_price: item.price || 0,
      opening_stock: 0,
      current_stock: 0,
      track_stock: false,
      is_active: true
    }));
  }

  if (outletType === 'main_bar' || outletType === 'executive_bar') {
    let query = supabase
      .from('bar_drinks')
      .select('id, name, price, cost_price, unit, is_available, branch_id')
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data, error } = await query;
    if (error) throw error;
    sourceRows = ((data || []) as Array<Record<string, any>>).map((item) => ({
      outlet_id: outlet.id,
      source_table: 'bar_drinks',
      source_item_id: item.id,
      sku: `${outletType === 'main_bar' ? 'M' : 'E'}-${item.id}`,
      name: item.name,
      category: outletType === 'main_bar' ? 'Main Bar' : 'Executive Bar',
      unit: item.unit || 'each',
      cost_price: item.cost_price || 0,
      selling_price: item.price || 0,
      opening_stock: 0,
      current_stock: 0,
      track_stock: true,
      is_active: true
    }));
  }

  if (!sourceRows.length) return [];

  const { error: upsertError } = await supabase
    .from('pos_outlet_items')
    .upsert(sourceRows, { onConflict: 'outlet_id,sku' });
  if (upsertError) throw upsertError;

  const { data, error } = await supabase
    .from('pos_outlet_items')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as Array<Record<string, any>>;
};

export const getOutlets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outlet_type } = req.query;
    let query = supabase
      .from('pos_outlets')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (outlet_type) query = query.eq('outlet_type', outlet_type as OutletType);
    if (!isGlobalUser(req)) {
      const branchId = branchIdFor(req);
      if (branchId) query = query.eq('branch_id', branchId);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', Number(req.query.branch_id));
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
};

export const getOutletItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outletId } = req.params;
    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    ensureBranchAccess(req, outlet.branch_id);

    const { data, error } = await supabase
      .from('pos_outlet_items')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    const items = (data || []) as Array<Record<string, any>>;
    res.json({
      success: true,
      data: items.length ? items : await seedOutletItemsFromExistingMenus(outlet)
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outletId } = req.params;
    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    ensureBranchAccess(req, outlet.branch_id);

    const { data, error } = await supabase
      .from('pos_outlet_shifts')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const openShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outletId } = req.params;
    const openingFloat = numberValue(req.body.opening_float);

    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    ensureBranchAccess(req, outlet.branch_id);

    const { data: existing, error: existingError } = await supabase
      .from('pos_outlet_shifts')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('status', 'open')
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw new AppError('This outlet already has an open shift', 409);

    const { data: shift, error: shiftError } = await supabase
      .from('pos_outlet_shifts')
      .insert({
        outlet_id: outletId,
        branch_id: outlet.branch_id,
        cashier_id: req.user.id,
        opening_float: openingFloat,
        status: 'open'
      })
      .select('*')
      .single();
    if (shiftError || !shift) throw shiftError || new AppError('Failed to open POS shift', 500);

    const { data: items, error: itemsError } = await supabase
      .from('pos_outlet_items')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('is_active', true);
    if (itemsError) throw itemsError;

    const stockRows = ((items || []) as Array<Record<string, any>>).map((item) => ({
      shift_id: shift.id,
      outlet_id: outletId,
      outlet_item_id: item.id,
      item_name: item.name,
      sku: item.sku,
      unit: item.unit || 'each',
      cost_price: item.cost_price || 0,
      selling_price: item.selling_price || 0,
      opening_stock: item.current_stock ?? item.opening_stock ?? 0,
      additions: 0,
      sold_quantity: 0,
      system_closing_stock: item.current_stock ?? item.opening_stock ?? 0
    }));

    if (stockRows.length) {
      const { error: stockError } = await supabase.from('pos_shift_stock_counts').insert(stockRows);
      if (stockError) throw stockError;
    }

    res.status(201).json({ success: true, data: shift });
  } catch (error) {
    next(error);
  }
};

export const getShiftOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    await ensureShiftAccess(req, shiftId);
    const { data, error } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
};

export const recordShiftOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    if (shift.status !== 'open') throw new AppError('Orders can only be recorded on an open shift', 400);

    const items = Array.isArray(req.body.items) ? req.body.items as Array<Record<string, any>> : [];
    if (!items.length) throw new AppError('At least one item is required', 400);

    const normalizedItems = items.map((item) => {
      const quantity = numberValue(item.qty ?? item.quantity);
      const unitPrice = numberValue(item.unit_price ?? item.selling_price ?? item.price);
      return {
        outlet_item_id: String(item.outlet_item_id ?? item.product_id ?? item.id ?? ''),
        name: String(item.name ?? item.item_name ?? ''),
        quantity,
        unit_price: unitPrice,
        line_total: quantity * unitPrice
      };
    });

    const totalAmount = numberValue(req.body.total_amount) ||
      normalizedItems.reduce((sum, item) => sum + numberValue(item.line_total), 0);

    const { data: order, error } = await supabase
      .from('pos_shift_orders')
      .insert({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        source_type: req.body.source_type || 'manual',
        source_id: req.body.source_id || null,
        order_number: req.body.order_number || `POS-${Date.now()}`,
        customer_name: req.body.customer_name || 'Walk-in',
        status: 'open',
        payment_status: 'unpaid',
        total_amount: totalAmount,
        items: normalizedItems,
        created_by: req.user.id
      })
      .select('*')
      .single();
    if (error || !order) throw error || new AppError('Failed to record POS order', 500);

    await updateStockForItems(shiftId, shift.outlet_id, normalizedItems, 1);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const payShiftOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    if (shift.status !== 'open') throw new AppError('Payments can only be recorded on an open shift', 400);

    const method = String(req.body.payment_method || req.body.method || 'cash').toLowerCase() as PaymentMethod;
    if (!['cash', 'mpesa', 'card', 'credit_bill'].includes(method)) {
      throw new AppError('Unsupported payment method', 400);
    }

    const { data: order, error: orderError } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('id', orderId)
      .eq('shift_id', shiftId)
      .single();
    if (orderError || !order) throw new AppError('POS order not found', 404);
    if (order.payment_status !== 'unpaid') throw new AppError('Order is already cleared', 409);

    const amount = numberValue(req.body.amount) || numberValue(order.total_amount);
    let creditBillId = req.body.credit_bill_id || null;

    if (method === 'credit_bill' && !creditBillId) {
      const creditBillPayload = req.body.credit_bill || {};
      const totalAmount = amount || numberValue(order.total_amount);
      const { data: creditBill, error: creditError } = await supabase
        .from('credit_bills')
        .insert({
          ...creditBillPayload,
          credit_number: creditBillPayload.credit_number || `CR${Date.now()}`,
          branch_id: creditBillPayload.branch_id || shift.branch_id,
          bill_type: creditBillPayload.bill_type || 'pos_sale',
          reference_type: 'pos_shift_order',
          reference_id: order.id,
          total_amount: creditBillPayload.total_amount || totalAmount,
          balance_amount: creditBillPayload.balance_amount || totalAmount,
          amount: creditBillPayload.amount || totalAmount,
          reason: creditBillPayload.reason || `Credit bill for POS order ${order.order_number || order.id}`,
          payment_method: 'credit_bill',
          deduction_months: creditBillPayload.deduction_months || 1,
          monthly_deduction: totalAmount / (creditBillPayload.deduction_months || 1),
          status: creditBillPayload.status || 'active',
          approval_status: 'pending',
          created_by: req.user.id
        })
        .select('id, credit_number')
        .single();

      if (creditError) throw new AppError(`Credit bill creation failed: ${creditError.message}`, 500);
      creditBillId = creditBill?.id || null;
    }

    const { data: payment, error: paymentError } = await supabase
      .from('pos_shift_payments')
      .insert({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        order_id: orderId,
        payment_method: method,
        amount,
        reference: req.body.reference || creditBillId || `POS-${method}-${Date.now()}`,
        credit_bill_id: creditBillId,
        received_by: req.user.id
      })
      .select('*')
      .single();
    if (paymentError || !payment) throw paymentError || new AppError('Failed to record payment', 500);

    const { error: updateError } = await supabase
      .from('pos_shift_orders')
      .update({
        status: method === 'credit_bill' ? 'credit_bill' : 'paid',
        payment_status: method === 'credit_bill' ? 'credit_bill' : 'paid',
        credit_bill_id: creditBillId,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);
    if (updateError) throw updateError;

    res.json({ success: true, data: { payment, credit_bill_id: creditBillId } });
  } catch (error) {
    next(error);
  }
};

export const getStockCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    await ensureShiftAccess(req, shiftId);
    const { data, error } = await supabase
      .from('pos_shift_stock_counts')
      .select('*')
      .eq('shift_id', shiftId)
      .order('item_name', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
};

export const updateStockCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    if (!['open', 'closed'].includes(String(shift.status))) {
      throw new AppError('Stock count cannot be edited after submission', 400);
    }

    const counts = Array.isArray(req.body.counts) ? req.body.counts as Array<Record<string, any>> : [];
    for (const row of counts) {
      const id = String(row.id || '');
      if (!id) continue;
      const physicalCount =
        row.physical_count === null || row.physical_count === undefined
          ? null
          : numberValue(row.physical_count);
      const additions = numberValue(row.additions);
      const soldQuantity = numberValue(row.sold_quantity);
      const systemClosingStock = numberValue(row.opening_stock) + additions - soldQuantity;

      const { error } = await supabase
        .from('pos_shift_stock_counts')
        .update({
          additions,
          sold_quantity: soldQuantity,
          system_closing_stock: systemClosingStock,
          physical_count: physicalCount,
          variance: physicalCount === null ? 0 : physicalCount - systemClosingStock,
          variance_reason: row.variance_reason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('shift_id', shiftId);
      if (error) throw error;
    }

    const { data, error: fetchError } = await supabase
      .from('pos_shift_stock_counts')
      .select('*')
      .eq('shift_id', shiftId)
      .order('item_name', { ascending: true });
    if (fetchError) throw fetchError;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
};

export const closeShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    if (shift.status !== 'open') throw new AppError('Only an open shift can be closed', 400);

    const { data: unclearedOrders, error: ordersError } = await supabase
      .from('pos_shift_orders')
      .select('id, order_number, total_amount')
      .eq('shift_id', shiftId)
      .eq('payment_status', 'unpaid');
    if (ordersError) throw ordersError;
    if ((unclearedOrders || []).length) {
      throw new AppError('Clear all bills or record them as credit bills before closing the shift', 409);
    }

    const { data: stockCounts, error: stockError } = await supabase
      .from('pos_shift_stock_counts')
      .select('*')
      .eq('shift_id', shiftId);
    if (stockError) throw stockError;

    const missingCounts = (stockCounts || []).filter((row: Record<string, any>) =>
      row.physical_count === null || row.physical_count === undefined
    );
    if (missingCounts.length) {
      throw new AppError('Enter physical stock count for every sellable item before closing', 409);
    }

    const unexplainedVariance = (stockCounts || []).filter((row: Record<string, any>) =>
      numberValue(row.variance) !== 0 && !String(row.variance_reason || '').trim()
    );
    if (unexplainedVariance.length) {
      throw new AppError('Explain every stock variance before closing the shift', 409);
    }

    const summary = await calculateShiftSummary(shiftId);
    const { data, error } = await supabase
      .from('pos_outlet_shifts')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        summary,
        updated_at: new Date().toISOString()
      })
      .eq('id', shiftId)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const submitShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    if (shift.status !== 'closed') throw new AppError('Close the shift before submitting it for accountant review', 400);

    const { data, error } = await supabase
      .from('pos_outlet_shifts')
      .update({
        status: 'pending_review',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', shiftId)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const reviewShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) {
      throw new AppError('Only accountants, auditors, managers, or admins can review POS shifts', 403);
    }
    const { shiftId } = req.params;
    await ensureShiftAccess(req, shiftId);
    const approved = req.body.approved === true || req.body.status === 'approved';
    const status = approved ? 'approved' : 'rejected';

    const { data, error } = await supabase
      .from('pos_outlet_shifts')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewer_id: req.user.id,
        review_notes: req.body.review_notes || req.body.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', shiftId)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getShiftSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    const summary = Object.keys(shift.summary || {}).length ? shift.summary : await calculateShiftSummary(shiftId);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Failed to load outlet POS shift summary', error);
    next(error);
  }
};
