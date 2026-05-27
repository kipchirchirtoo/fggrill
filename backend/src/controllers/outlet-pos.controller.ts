import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

type OutletType =
  | 'restaurant'
  | 'main_bar'
  | 'executive_bar'
  | 'non_consumables'
  | 'cashier'
  | 'kyogong_reception'
  | 'kyogong_spa'
  | 'kyogong_executive_bar'
  | 'kyogong_sports_bar';
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

const MANAGE_OUTLET_ROLES = new Set([
  'super_admin',
  'general_manager',
  'director',
  'branch_manager',
  'restaurant_manager',
  'bar_manager',
  'finance_manager',
  'accountant',
  'branch_accountant'
]);

const PROFIT_VIEW_ROLES = new Set([
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

const canViewProfit = (req: Request): boolean => PROFIT_VIEW_ROLES.has(roleFor(req));

const canManageOutlets = (req: Request): boolean => MANAGE_OUTLET_ROLES.has(roleFor(req));

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

const ensureOutletManagementAccess = (req: Request, branchId?: unknown): void => {
  if (!canManageOutlets(req)) {
    throw new AppError('Forbidden: POS outlet management requires an admin or manager role', 403);
  }
  if (branchId !== undefined && branchId !== null) {
    ensureBranchAccess(req, branchId);
  }
};

const ensureShiftAccess = async (req: Request, shiftId: string) => {
  const shift = await loadShift(shiftId);
  ensureBranchAccess(req, shift.branch_id);
  return shift;
};

const sanitizeSummary = (summary: Record<string, any>, includeProfit: boolean): Record<string, any> => {
  if (includeProfit) return summary;
  const {
    total_cost_of_goods_sold,
    gross_profit,
    profit_margin,
    stock_value_variance,
    ...cashierSummary
  } = summary;

  if (Array.isArray(cashierSummary.item_sales)) {
    cashierSummary.item_sales = cashierSummary.item_sales.map((item: Record<string, any>) => {
      const { cost_price, cost_of_goods_sold, gross_profit: itemProfit, profit_margin: itemMargin, ...safeItem } = item;
      return safeItem;
    });
  }

  return cashierSummary;
};

const calculateShiftSummary = async (shiftId: string) => {
  const [
    { data: payments, error: paymentsError },
    { data: counts, error: countsError },
    { data: orders, error: ordersError },
    shift
  ] = await Promise.all([
    supabase.from('pos_shift_payments').select('*').eq('shift_id', shiftId),
    supabase.from('pos_shift_stock_counts').select('*').eq('shift_id', shiftId),
    supabase.from('pos_shift_orders').select('*').eq('shift_id', shiftId),
    loadShift(shiftId)
  ]);

  if (paymentsError) throw paymentsError;
  if (countsError) throw countsError;
  if (ordersError) throw ordersError;

  const paymentRows = (payments || []) as Array<Record<string, any>>;
  const countRows = (counts || []) as Array<Record<string, any>>;
  const orderRows = (orders || []) as Array<Record<string, any>>;
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
  const itemSales = countRows.map((row) => {
    const soldQuantity = numberValue(row.sold_quantity);
    const sellingPrice = numberValue(row.selling_price);
    const costPrice = numberValue(row.cost_price);
    const salesTotal = soldQuantity * sellingPrice;
    const costOfGoodsSold = soldQuantity * costPrice;
    const itemProfit = salesTotal - costOfGoodsSold;
    return {
      outlet_item_id: row.outlet_item_id,
      item_name: row.item_name,
      sku: row.sku,
      unit: row.unit,
      quantity_sold: soldQuantity,
      selling_price: sellingPrice,
      sales_total: salesTotal,
      cost_price: costPrice,
      cost_of_goods_sold: costOfGoodsSold,
      gross_profit: itemProfit,
      profit_margin: salesTotal > 0 ? (itemProfit / salesTotal) * 100 : 0
    };
  });
  const openingFloat = numberValue(shift.opening_float);
  const cashSales = numberValue(salesByMethod.cash);
  const expectedCash = openingFloat + cashSales;
  const closingCashCounted =
    shift.closing_cash_counted === null || shift.closing_cash_counted === undefined
      ? null
      : numberValue(shift.closing_cash_counted);

  return {
    total_sales: totalSales,
    total_cash_sales: salesByMethod.cash,
    total_mpesa_sales: salesByMethod.mpesa,
    total_card_sales: salesByMethod.card,
    total_credit_sales: salesByMethod.credit_bill,
    total_cost_of_goods_sold: totalCogs,
    gross_profit: grossProfit,
    profit_margin: profitMargin,
    sales_by_method: salesByMethod,
    item_sales: itemSales,
    items_sold: countRows.reduce((sum, row) => sum + numberValue(row.sold_quantity), 0),
    order_count: orderRows.length,
    open_order_count: orderRows.filter((row) => ['unpaid', 'partial'].includes(String(row.payment_status))).length,
    opening_float: openingFloat,
    expected_cash: expectedCash,
    closing_cash_counted: closingCashCounted,
    cash_variance: closingCashCounted === null ? null : closingCashCounted - expectedCash,
    generated_at: new Date().toISOString()
  };
};

const createStaffCreditBill = async (
  req: Request,
  shift: Record<string, any>,
  order: Record<string, any>,
  amount: number,
  creditBillPayload: Record<string, any>
): Promise<string> => {
  const staffId = String(
    creditBillPayload.staff_id ||
    creditBillPayload.staffId ||
    creditBillPayload.employee_id ||
    ''
  ).trim();
  if (!staffId) {
    throw new AppError('Staff member is required for credit bill clearance', 400);
  }

  const { data: staff, error: staffError } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name, branch_id')
    .eq('id', staffId)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff) throw new AppError('Staff account not found for credit bill', 404);
  if (!isGlobalUser(req) && Number(staff.branch_id) !== Number(shift.branch_id)) {
    throw new AppError('Cannot allocate credit bill to staff from another branch', 403);
  }

  const creditNumber = creditBillPayload.credit_number || `SCB-${Date.now()}`;
  const description = String(
    creditBillPayload.description ||
    creditBillPayload.reason ||
    `POS credit bill for ${order.order_number || order.id}`
  );

  const { data: creditBill, error: creditError } = await supabase
    .from('staff_credit_bills')
    .insert({
      staff_id: staffId,
      amount,
      description,
      bill_date: creditBillPayload.bill_date || new Date().toISOString().slice(0, 10),
      status: creditBillPayload.status || 'pending',
      credit_number: creditNumber,
      branch_id: shift.branch_id,
      created_by: req.user?.id,
      source_pos_shift_id: shift.id,
      source_pos_order_id: order.id
    })
    .select('id')
    .single();

  if (creditError || !creditBill) {
    throw new AppError(`Staff credit bill creation failed: ${creditError?.message || 'Unknown error'}`, 500);
  }

  return String(creditBill.id);
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

  if (outletType === 'main_bar' || outletType === 'executive_bar' ||
      outletType === 'kyogong_executive_bar' || outletType === 'kyogong_sports_bar') {
    let query = supabase
      .from('bar_drinks')
      .select('id, name, price, cost_price, unit, is_available, branch_id')
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data, error } = await query;
    if (error) throw error;
    const prefix =
      outletType === 'main_bar' ? 'M' :
      outletType === 'executive_bar' ? 'E' :
      outletType === 'kyogong_executive_bar' ? 'KX' : 'KS';
    sourceRows = ((data || []) as Array<Record<string, any>>).map((item) => ({
      outlet_id: outlet.id,
      source_table: 'bar_drinks',
      source_item_id: item.id,
      sku: `${prefix}-${item.id}`,
      name: item.name,
      category: outletType.includes('executive') ? 'Executive Bar' : 'Main Bar',
      unit: item.unit || 'each',
      cost_price: item.cost_price || 0,
      selling_price: item.price || 0,
      opening_stock: 0,
      current_stock: 0,
      track_stock: true,
      is_active: true
    }));
  }

  if (outletType === 'kyogong_spa') {
    let query = supabase
      .from('spa_services')
      .select('id, name, base_price, category, is_active, branch_id')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data, error } = await query;
    if (error) throw error;
    sourceRows = ((data || []) as Array<Record<string, any>>).map((item) => ({
      outlet_id: outlet.id,
      source_table: 'spa_services',
      source_item_id: null,
      sku: `KSPA-${item.id}`,
      name: item.name,
      category: item.category || 'Spa',
      unit: 'service',
      cost_price: 0,
      selling_price: item.base_price || 0,
      opening_stock: 0,
      current_stock: 0,
      track_stock: false,
      is_active: true
    }));
  }

  if (outletType === 'kyogong_reception') {
    let query = supabase
      .from('dynamic_services')
      .select('id, name, base_price, service_type, is_active, branch_id')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data, error } = await query;
    if (error) throw error;
    sourceRows = ((data || []) as Array<Record<string, any>>).map((item) => ({
      outlet_id: outlet.id,
      source_table: 'dynamic_services',
      source_item_id: null,
      sku: `KREC-${item.id}`,
      name: item.name,
      category: item.service_type || 'Kyogong',
      unit: 'service',
      cost_price: 0,
      selling_price: item.base_price || 0,
      opening_stock: 0,
      current_stock: 0,
      track_stock: false,
      is_active: true
    }));
  }

  if (outletType === 'non_consumables') {
    let query = supabase
      .from('dynamic_services')
      .select('id, name, base_price, service_type, is_active, branch_id')
      .eq('is_active', true)
      .in('service_type', [
        'swimming',
        'pool',
        'pool_token',
        'pool_tokens',
        'car_wash',
        'sauna',
        'non_consumable',
        'non_consumables'
      ])
      .order('name', { ascending: true });
    if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data, error } = await query;
    if (error) throw error;
    sourceRows = ((data || []) as Array<Record<string, any>>).map((item) => ({
      outlet_id: outlet.id,
      source_table: 'dynamic_services',
      source_item_id: null,
      sku: `NDS-${item.id}`,
      name: item.name,
      category: item.service_type || 'Non-consumables',
      unit: 'service',
      cost_price: 0,
      selling_price: item.base_price || 0,
      opening_stock: 0,
      current_stock: 0,
      track_stock: false,
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

export const createOutlet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const branchId = Number(req.body.branch_id ?? req.body.branchId ?? branchIdFor(req));
    if (!Number.isFinite(branchId)) throw new AppError('Branch is required', 400);
    ensureOutletManagementAccess(req, branchId);

    const outletType = String(req.body.outlet_type || req.body.outletType || '').trim() as OutletType;
    const name = String(req.body.name || '').trim();
    const pinPrefix = String(req.body.pin_prefix || req.body.pinPrefix || '').trim().toUpperCase();
    if (!outletType || !name || !pinPrefix) {
      throw new AppError('Outlet type, name and PIN prefix are required', 400);
    }

    const { data, error } = await supabase
      .from('pos_outlets')
      .upsert({
        branch_id: branchId,
        outlet_type: outletType,
        name,
        pin_prefix: pinPrefix,
        is_active: req.body.is_active ?? req.body.isActive ?? true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'branch_id,outlet_type' })
      .select('*')
      .single();

    if (error || !data) throw error || new AppError('Failed to save POS outlet', 500);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateOutlet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outletId } = req.params;
    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    ensureOutletManagementAccess(req, outlet.branch_id);

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (req.body.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body.pin_prefix !== undefined || req.body.pinPrefix !== undefined) {
      patch.pin_prefix = String(req.body.pin_prefix ?? req.body.pinPrefix).trim().toUpperCase();
    }
    if (req.body.is_active !== undefined || req.body.isActive !== undefined) {
      patch.is_active = req.body.is_active ?? req.body.isActive;
    }

    const { data, error } = await supabase
      .from('pos_outlets')
      .update(patch)
      .eq('id', outletId)
      .select('*')
      .single();

    if (error || !data) throw error || new AppError('Failed to update POS outlet', 500);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const normalizeOutletItemPayload = (
  outletId: string,
  payload: Record<string, any>,
  existing?: Record<string, any>
): Record<string, any> => {
  const name = payload.name !== undefined ? String(payload.name).trim() : existing?.name;
  if (!name) throw new AppError('Item name is required', 400);
  const sku = String(payload.sku ?? existing?.sku ?? `${Date.now()}`).trim();
  return {
    outlet_id: outletId,
    source_table: payload.source_table ?? existing?.source_table ?? 'manual',
    source_item_id: payload.source_item_id ?? existing?.source_item_id ?? null,
    sku,
    name,
    category: payload.category ?? existing?.category ?? 'Manual',
    unit: payload.unit ?? existing?.unit ?? 'each',
    cost_price: numberValue(payload.cost_price ?? payload.costPrice ?? existing?.cost_price),
    selling_price: numberValue(payload.selling_price ?? payload.sellingPrice ?? payload.price ?? existing?.selling_price),
    opening_stock: numberValue(payload.opening_stock ?? payload.openingStock ?? existing?.opening_stock),
    current_stock: numberValue(payload.current_stock ?? payload.currentStock ?? existing?.current_stock),
    track_stock: payload.track_stock ?? payload.trackStock ?? existing?.track_stock ?? true,
    is_active: payload.is_active ?? payload.isActive ?? existing?.is_active ?? true,
    updated_at: new Date().toISOString()
  };
};

export const createOutletItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outletId } = req.params;
    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    ensureOutletManagementAccess(req, outlet.branch_id);

    const row = normalizeOutletItemPayload(outletId, req.body || {});
    const { data, error } = await supabase
      .from('pos_outlet_items')
      .upsert(row, { onConflict: 'outlet_id,sku' })
      .select('*')
      .single();

    if (error || !data) throw error || new AppError('Failed to save outlet item', 500);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateOutletItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outletId, itemId } = req.params;
    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    ensureOutletManagementAccess(req, outlet.branch_id);

    const { data: existing, error: existingError } = await supabase
      .from('pos_outlet_items')
      .select('*')
      .eq('id', itemId)
      .eq('outlet_id', outletId)
      .single();
    if (existingError || !existing) throw new AppError('Outlet item not found', 404);

    const row = normalizeOutletItemPayload(outletId, req.body || {}, existing);
    const { data, error } = await supabase
      .from('pos_outlet_items')
      .update(row)
      .eq('id', itemId)
      .eq('outlet_id', outletId)
      .select('*')
      .single();

    if (error || !data) throw error || new AppError('Failed to update outlet item', 500);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const syncOutletItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outletId } = req.params;
    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    ensureOutletManagementAccess(req, outlet.branch_id);

    const data = await seedOutletItemsFromExistingMenus(outlet);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
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

export const getOutletStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const branchId = branchIdFor(req);
    const search = String(req.query.search || '').trim().toLowerCase();

    let query = supabase
      .from('staff_profiles')
      .select('id, first_name, last_name, id_number, role, department, branch_id')
      .order('first_name', { ascending: true })
      .limit(100);

    if (!isGlobalUser(req) && branchId) {
      query = query.eq('branch_id', branchId);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', Number(req.query.branch_id));
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data || []) as Array<Record<string, any>>)
      .filter((staff) => {
        if (!search) return true;
        const text = [
          staff.first_name,
          staff.last_name,
          staff.id_number,
          staff.role,
          staff.department
        ].join(' ').toLowerCase();
        return text.includes(search);
      })
      .map((staff) => ({
        id: staff.id,
        name: `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.id_number || staff.id,
        id_number: staff.id_number,
        role: staff.role,
        department: staff.department,
        branch_id: staff.branch_id
      }));

    res.json({ success: true, data: rows });
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
    const responseData = data && data.summary
      ? { ...data, summary: sanitizeSummary(data.summary, canViewProfit(req)) }
      : data;
    res.json({ success: true, data: responseData });
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
      system_closing_stock: item.current_stock ?? item.opening_stock ?? 0,
      track_stock: item.track_stock !== false
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
        waiter_id: req.body.waiter_id || req.user.id,
        waiter_name: req.body.waiter_name || req.user.name || req.user.email || null,
        status: 'open',
        payment_status: 'unpaid',
        total_amount: totalAmount,
        amount_paid: 0,
        balance_amount: totalAmount,
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
    if (['paid', 'credit_bill', 'voided'].includes(String(order.payment_status))) {
      throw new AppError('Order is already cleared', 409);
    }

    const currentPaid = numberValue(order.amount_paid);
    const totalAmount = numberValue(order.total_amount);
    const currentBalance = Math.max(0, numberValue(order.balance_amount) || totalAmount - currentPaid);
    const requestedAmount = numberValue(req.body.amount);
    const amount = requestedAmount > 0 ? requestedAmount : currentBalance;
    if (amount <= 0) throw new AppError('Payment amount must be greater than zero', 400);
    if (amount - currentBalance > 0.01) throw new AppError('Payment cannot exceed remaining bill balance', 400);

    let staffCreditBillId = req.body.staff_credit_bill_id || null;
    if (method === 'credit_bill' && !staffCreditBillId) {
      staffCreditBillId = await createStaffCreditBill(req, shift, order, amount, req.body.credit_bill || {});
    }

    const { data: payment, error: paymentError } = await supabase
      .from('pos_shift_payments')
      .insert({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        order_id: orderId,
        payment_method: method,
        amount,
        reference: req.body.reference || staffCreditBillId || `POS-${method}-${Date.now()}`,
        credit_bill_id: req.body.credit_bill_id || null,
        staff_credit_bill_id: staffCreditBillId,
        received_by: req.user.id
      })
      .select('*')
      .single();
    if (paymentError || !payment) throw paymentError || new AppError('Failed to record payment', 500);

    if (staffCreditBillId) {
      await supabase
        .from('staff_credit_bills')
        .update({ source_pos_payment_id: payment.id, updated_at: new Date().toISOString() })
        .eq('id', staffCreditBillId);
    }

    const newPaid = currentPaid + amount;
    const newBalance = Math.max(0, totalAmount - newPaid);
    const isCleared = newBalance <= 0.01;
    const nextPaymentStatus = isCleared
      ? method === 'credit_bill' ? 'credit_bill' : 'paid'
      : 'partial';
    const nextStatus = isCleared
      ? method === 'credit_bill' ? 'credit_bill' : 'paid'
      : 'open';

    const { error: updateError } = await supabase
      .from('pos_shift_orders')
      .update({
        status: nextStatus,
        payment_status: nextPaymentStatus,
        amount_paid: newPaid,
        balance_amount: newBalance,
        staff_credit_bill_id: staffCreditBillId || order.staff_credit_bill_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);
    if (updateError) throw updateError;

    res.json({
      success: true,
      data: {
        payment,
        staff_credit_bill_id: staffCreditBillId,
        amount_paid: newPaid,
        balance_amount: newBalance,
        payment_status: nextPaymentStatus
      }
    });
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
      .in('payment_status', ['unpaid', 'partial']);
    if (ordersError) throw ordersError;
    if ((unclearedOrders || []).length) {
      throw new AppError('Clear all bills or record them as credit bills before closing the shift', 409);
    }

    const { data: stockCounts, error: stockError } = await supabase
      .from('pos_shift_stock_counts')
      .select('*')
      .eq('shift_id', shiftId);
    if (stockError) throw stockError;

    const trackedStockCounts = (stockCounts || []).filter((row: Record<string, any>) => row.track_stock !== false);
    const missingCounts = trackedStockCounts.filter((row: Record<string, any>) =>
      row.physical_count === null || row.physical_count === undefined
    );
    if (missingCounts.length) {
      throw new AppError('Enter physical stock count for every sellable item before closing', 409);
    }

    const unexplainedVariance = trackedStockCounts.filter((row: Record<string, any>) =>
      numberValue(row.variance) !== 0 && !String(row.variance_reason || '').trim()
    );
    if (unexplainedVariance.length) {
      throw new AppError('Explain every stock variance before closing the shift', 409);
    }

    for (const row of trackedStockCounts as Array<Record<string, any>>) {
      await supabase
        .from('pos_outlet_items')
        .update({
          current_stock: numberValue(row.physical_count),
          updated_at: new Date().toISOString()
        })
        .eq('id', row.outlet_item_id)
        .eq('outlet_id', shift.outlet_id);
    }

    const closingCashCounted = numberValue(req.body.closing_cash_counted ?? req.body.closingCashCounted);
    if (!Number.isFinite(closingCashCounted) || closingCashCounted < 0) {
      throw new AppError('Closing cash count is required before closing the shift', 400);
    }

    const summary = await calculateShiftSummary(shiftId);
    const expectedCash = numberValue(summary.expected_cash);
    const cashVariance = closingCashCounted - expectedCash;
    const varianceThreshold = Math.max(expectedCash * 0.05, 1000);
    const cashVarianceReason = String(req.body.cash_variance_reason || req.body.variance_reason || '').trim();
    if (Math.abs(cashVariance) > varianceThreshold && !cashVarianceReason) {
      throw new AppError('Explain the cash variance before closing the shift', 409);
    }

    const finalSummary = {
      ...summary,
      closing_cash_counted: closingCashCounted,
      cash_variance: cashVariance
    };
    const { data, error } = await supabase
      .from('pos_outlet_shifts')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_cash_counted: closingCashCounted,
        expected_cash: expectedCash,
        cash_variance: cashVariance,
        cash_variance_reason: cashVarianceReason || null,
        summary: finalSummary,
        updated_at: new Date().toISOString()
      })
      .eq('id', shiftId)
      .select('*')
      .single();
    if (error) throw error;
    res.json({
      success: true,
      data: { ...data, summary: sanitizeSummary(data.summary || finalSummary, canViewProfit(req)) }
    });
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
    res.json({
      success: true,
      data: { ...data, summary: sanitizeSummary(data.summary || {}, canViewProfit(req)) }
    });
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
    res.json({
      success: true,
      data: { ...data, summary: sanitizeSummary(data.summary || {}, canViewProfit(req)) }
    });
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
    res.json({ success: true, data: sanitizeSummary(summary, canViewProfit(req)) });
  } catch (error) {
    logger.error('Failed to load outlet POS shift summary', error);
    next(error);
  }
};
