import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import notificationService from '../services/notification.service';
import { ensureShiftAutomationOpened, runShiftCloseAutomation } from '../services/cashier-automation.service';
import {
  assertPosStockAvailable,
  postPosInventorySale
} from '../services/enterprise-inventory.service';
import { closeOutletVariance } from '../services/inventory-operations.service';
import {
  assignedOutletIds,
  canAccessPosOutlet,
  isCashierStationRole,
  loadAssignedPosOutlets,
  shouldRestrictCashierStationAccess,
  stationTypesForCashierRole
} from '../utils/posStationAccess';
import { createBillVerificationCode } from '../services/bill-verification-code.service';

// Roles permitted to open/close a POS shift on behalf of a station.
const SHIFT_MANAGER_ROLES = new Set([
  'super_admin',
  'general_manager',
  'branch_manager',
  'branch_accountant',
  'accountant',
]);

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

const FOOD_AND_BAR_OUTLET_TYPES = new Set<OutletType>([
  'restaurant',
  'main_bar',
  'executive_bar',
  'kyogong_executive_bar',
  'kyogong_sports_bar'
]);

const isFoodOrBarOutlet = (outletType: unknown): boolean =>
  FOOD_AND_BAR_OUTLET_TYPES.has(String(outletType || '') as OutletType);

// This backend never attempts its own cloud-side captain-order print (via
// captainOrderPrint.service -> python-services). This backend and
// python-services both run on Render's cloud infrastructure, with zero
// network path to a printer plugged into a USB port (or sitting on a
// private LAN) at a branch — that connection is not reachable, full stop,
// regardless of which language attempts to open it. The only thing in this
// codebase that can ever physically reach that printer is code running ON
// the branch's own machine:
//  - Main Bar / Executive Bar: the bar cashier's Flutter screen polls
//    getBarCaptainOrders below and prints locally via PrintService -> a
//    local print agent at localhost (see print_service.dart).
//  - Restaurant: orders land in pos_shift_orders; GET /restaurant/kitchen/orders
//    merges these into the KDS feed (alongside restaurant_orders), so the KDS
//    auto-prints the captain order on the kitchen printer within its 5 s poll.
//    The waiter screen prints the customer bill only.
// This backend only ever supplies the order data; it never attempts the
// print itself.
//
// Strictly the two bar outlets — used only for the Main Bar / Executive Bar
// cashier station's own polling feed (getBarCaptainOrders below). Restaurant
// orders must never appear here: they belong to this local-print path only.
const BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES = new Set<OutletType>([
  'main_bar',
  'executive_bar'
]);

const outletItemGroup = (outletType: unknown): 'restaurant' | 'bar' | 'other' => {
  const type = String(outletType || '');
  if (type === 'restaurant') return 'restaurant';
  if (isFoodOrBarOutlet(type)) return 'bar';
  return 'other';
};

const billTypeForOutlet = (outletType: unknown): 'restaurant' | 'bar' | 'pool' | 'carwash' | 'spa' | 'pos_outlet' | 'other' => {
  const type = String(outletType || '').toLowerCase();
  if (type === 'restaurant') return 'restaurant';
  if (type.includes('bar')) return 'bar';
  if (type.includes('spa')) return 'spa';
  if (type.includes('pool')) return 'pool';
  if (type.includes('car_wash') || type.includes('carwash')) return 'carwash';
  if (type.includes('non_consumable') || type.includes('cashier')) return 'pos_outlet';
  return 'other';
};

const categoryText = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'object') {
    const record = value as Record<string, any>;
    return String(record.name ?? record.category_name ?? record.label ?? '').trim();
  }
  const text = String(value).trim();
  return text === 'null' || text === 'undefined' ? '' : text;
};

const normaliseName = (value: unknown): string =>
  categoryText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const removeCrossBranchOutletLeaks = async (
  outlets: Array<Record<string, any>>
): Promise<Array<Record<string, any>>> => {
  if (!outlets.length) return outlets;

  try {
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id,name');
    if (error || !branches?.length) return outlets;

    const branchNames = (branches as Array<Record<string, any>>)
      .map((branch) => ({
        id: Number(branch.id),
        name: normaliseName(branch.name)
      }))
      .filter((branch) => Number.isFinite(branch.id) && branch.name.length >= 4);
    const branchNameById = new Map(branchNames.map((branch) => [branch.id, branch.name]));

    return outlets.filter((outlet) => {
      const outletBranchId = Number(outlet.branch_id);
      const ownBranchName = branchNameById.get(outletBranchId) || '';
      const outletName = normaliseName(outlet.name);
      const nameWithoutOwnBranch = ownBranchName
        ? outletName.replace(ownBranchName, '').trim()
        : outletName;

      return !branchNames.some((branch) =>
        branch.id !== outletBranchId && nameWithoutOwnBranch.includes(branch.name)
      );
    });
  } catch (error) {
    logger.warn('Failed to apply cross-branch POS outlet name filter', error);
    return outlets;
  }
};

const isGenericOutletCategory = (category: string, group: 'restaurant' | 'bar' | 'other'): boolean => {
  const lower = category.trim().toLowerCase();
  if (!lower) return true;
  if (group === 'restaurant') return lower === 'restaurant' || lower === 'other';
  if (group === 'bar') {
    return [
      'bar',
      'main bar',
      'executive bar',
      'kyogong executive bar',
      'kyogong sports bar',
      'other'
    ].includes(lower);
  }
  return lower === 'uncategorised' || lower === 'uncategorized' || lower === 'other';
};

const sourceIdForOutletItem = (item: Record<string, any>, prefix: string): string | null => {
  const explicitId = categoryText(item.source_item_id);
  if (explicitId) return explicitId;
  if (!prefix) return null;
  const sku = categoryText(item.sku);
  return sku.startsWith(prefix) ? sku.slice(prefix.length) : null;
};

const applySourceCategory = (
  item: Record<string, any>,
  categoryName?: string,
  categoryId?: string | null,
  sortOrder?: number | null
): Record<string, any> => {
  const group = outletItemGroup(item.outlet_type);
  const currentCategory = categoryText(item.category);
  const nextCategory =
    categoryName && isGenericOutletCategory(currentCategory, group)
      ? categoryName
      : currentCategory || categoryName || 'Other';
  return {
    ...item,
    category: nextCategory,
    category_name: nextCategory,
    category_id: categoryId ?? item.category_id ?? null,
    category_sort_order: sortOrder ?? item.category_sort_order ?? null
  };
};

const sortOutletItems = (
  a: Record<string, any>,
  b: Record<string, any>
): number => {
  const group = String(a.item_group_label || '').localeCompare(String(b.item_group_label || ''));
  if (group !== 0) return group;
  const aSort = Number.isFinite(Number(a.category_sort_order)) ? Number(a.category_sort_order) : 9999;
  const bSort = Number.isFinite(Number(b.category_sort_order)) ? Number(b.category_sort_order) : 9999;
  if (aSort !== bSort) return aSort - bSort;
  const category = String(a.category || '').localeCompare(String(b.category || ''));
  if (category !== 0) return category;
  return String(a.name || '').localeCompare(String(b.name || ''));
};

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
  'branch_accountant',
  'branch_storekeeper',
  'central_storekeeper',
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

const ORDER_OWNER_SCOPED_ROLES = new Set([
  'restaurant',
  'waiter',
  'waitress',
  'head_waiter',
  'bartender',
  'barman',
  'barmaid',
  'barista',
  'food_runner'
]);

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const branchIdFor = (req: Request): number | null => {
  const raw = req.user?.branch_id ?? req.user?.branchId ?? req.query.branch_id;
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const roleFor = (req: Request): string => String(req.user?.role ?? '').toLowerCase();

const isGlobalUser = (req: Request): boolean => GLOBAL_ROLES.has(roleFor(req));

const canViewProfit = (req: Request): boolean => PROFIT_VIEW_ROLES.has(roleFor(req));

const canManageOutlets = (req: Request): boolean => MANAGE_OUTLET_ROLES.has(roleFor(req));

const shouldScopeOrdersToOwner = (req: Request): boolean => ORDER_OWNER_SCOPED_ROLES.has(roleFor(req));

const ensureOrderOwnerAccess = (req: Request, order: Record<string, any>): void => {
  if (!shouldScopeOrdersToOwner(req)) return;
  const userId = String(req.user?.id || '');
  if (!userId) throw new AppError('Authentication required', 401);
  const waiterId = String(order.waiter_id || '');
  const createdBy = String(order.created_by || '');
  if (waiterId !== userId && createdBy !== userId) {
    throw new AppError('Forbidden: waiters can only access their own orders', 403);
  }
};

const normalizePaymentMethod = (value: unknown): PaymentMethod | null => {
  const method = String(value || 'cash').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (method === 'cash') return 'cash';
  if (['mpesa', 'm_pesa', 'mpesa_manual', 'm_pesa_manual', 'mobile_money'].includes(method)) return 'mpesa';
  if (['card', 'card_manual', 'swipe', 'bank_card', 'pos_card'].includes(method)) return 'card';
  if (['credit_bill', 'credit_bill_manual', 'bill', 'staff_credit', 'staff_credit_bill'].includes(method)) return 'credit_bill';
  return null;
};

const nullableText = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text ? text : null;
};

const normalizeOrderType = (value: unknown, outletType: unknown): string => {
  const requested = String(value || '').trim().toLowerCase();
  if (['dine_in', 'takeaway', 'room_service', 'bar', 'counter', 'non_consumable'].includes(requested)) {
    return requested;
  }
  const stationType = String(outletType || '').trim().toLowerCase();
  if (stationType === 'restaurant') return 'takeaway';
  if (stationType === 'non_consumables') return 'non_consumable';
  if (stationType.includes('bar')) return 'bar';
  return 'counter';
};

const orderContextPatch = (
  body: Record<string, any>,
  order: Record<string, any> | null,
  outletType: unknown
): Record<string, any> => {
  const orderType = normalizeOrderType(body.order_type ?? order?.order_type, outletType);
  return {
    order_type: orderType,
    table_number: orderType === 'dine_in'
      ? nullableText(body.table_number ?? order?.table_number)
      : null,
    room_number: orderType === 'room_service'
      ? nullableText(body.room_number ?? order?.room_number)
      : null
  };
};

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
  const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
  if (outlet) {
    await ensureCashierOutletAccess(req, outlet);
  }
  return shift;
};

const ensureCashierOutletAccess = async (req: Request, outlet: Record<string, any>): Promise<void> => {
  ensureBranchAccess(req, outlet.branch_id);
  const role = roleFor(req);
  const assignedOutlets = await loadAssignedPosOutlets(supabase, req.user?.id);
  if (!canAccessPosOutlet(role, outlet, assignedOutlets)) {
    throw new AppError('Forbidden: this cashier is not assigned to this POS station', 403);
  }
};

const loadShiftOrder = async (shiftId: string, orderId: string) => {
  const { data, error } = await supabase
    .from('pos_shift_orders')
    .select('*')
    .eq('id', orderId)
    .eq('shift_id', shiftId)
    .single();
  if (error || !data) throw new AppError('POS order not found', 404);
  return data as Record<string, any>;
};

const ensureEditableOrder = (order: Record<string, any>, action: string): void => {
  const paymentStatus = String(order.payment_status || '');
  const status = String(order.status || '');
  if (['paid', 'credit_bill', 'voided'].includes(paymentStatus) || ['paid', 'credit_bill', 'voided', 'cancelled'].includes(status)) {
    throw new AppError(`Cannot ${action} a cleared, voided, or cancelled bill`, 400);
  }
};

const normalizeOrderItems = async (
  outletId: string,
  items: Array<Record<string, any>>
): Promise<Array<Record<string, any>>> => {
  const requestedIds = Array.from(new Set(
    items.map((item) => String(item.outlet_item_id ?? item.product_id ?? item.id ?? '')).filter(Boolean)
  ));

  const outletItemById = new Map<string, Record<string, any>>();
  if (requestedIds.length) {
    const { data: outletItems, error } = await supabase
      .from('pos_outlet_items')
      .select('id, name, selling_price, is_active')
      .eq('outlet_id', outletId)
      .in('id', requestedIds);
    if (error) throw error;
    for (const outletItem of outletItems || []) {
      outletItemById.set(String(outletItem.id), outletItem);
    }
  }

  return items.map((item, index) => {
    const quantity = numberValue(item.qty ?? item.quantity);
    const outletItemId = String(item.outlet_item_id ?? item.product_id ?? item.id ?? '');
    if (!outletItemId || quantity <= 0) {
      throw new AppError(`Invalid item at line ${index + 1}`, 400);
    }
    const menuItem = outletItemById.get(outletItemId);
    if (!menuItem || menuItem.is_active === false) {
      throw new AppError(`Item at line ${index + 1} is not a valid menu item for this outlet`, 400);
    }
    const unitPrice = numberValue(menuItem.selling_price);
    return {
      outlet_item_id: outletItemId,
      name: String(menuItem.name ?? ''),
      category: item.category ?? null,
      item_group: item.item_group ?? null,
      item_group_label: item.item_group_label ?? null,
      outlet_name: item.outlet_name ?? null,
      outlet_type: item.outlet_type ?? null,
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice
    };
  });
};

const orderItemsTotal = (items: Array<Record<string, any>>): number =>
  items.reduce((sum, item) => {
    const lineTotal = numberValue(item.line_total ?? item.total_price ?? item.total);
    if (lineTotal > 0) return sum + lineTotal;
    return sum + numberValue(item.quantity ?? item.qty) * numberValue(item.unit_price ?? item.price);
  }, 0);

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
      const method = normalizePaymentMethod(row.payment_method);
      if (method && acc[method] !== undefined) {
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
    if (countRow) {
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
    }

    const { data: outletItem, error: itemError } = await supabase
      .from('pos_outlet_items')
      .select('current_stock, outlet_id, track_stock, stock_pool_item_id, pool_fraction')
      .eq('id', outletItemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!outletItem) continue;
    if (outletItem.track_stock === false) continue;

    // Pool-aware deduction: items sharing a stock pool (e.g. Half/Quarter
    // Chicken sharing the Full Chicken pool) have no independent stock of
    // their own — deduct the pool-equivalent quantity from the pool item.
    if (outletItem.stock_pool_item_id) {
      const { data: poolItem, error: poolError } = await supabase
        .from('pos_outlet_items')
        .select('current_stock')
        .eq('id', outletItem.stock_pool_item_id)
        .maybeSingle();
      if (poolError) throw poolError;
      if (poolItem) {
        const fraction = numberValue(outletItem.pool_fraction) || 1;
        await supabase
          .from('pos_outlet_items')
          .update({
            current_stock: Math.max(0, numberValue(poolItem.current_stock) - direction * quantity * fraction),
            updated_at: new Date().toISOString()
          })
          .eq('id', outletItem.stock_pool_item_id);
      }
      continue;
    }

    await supabase
      .from('pos_outlet_items')
      .update({
        current_stock: Math.max(0, numberValue(outletItem.current_stock) - direction * quantity),
        updated_at: new Date().toISOString()
      })
      .eq('id', outletItemId)
      .eq('outlet_id', outletItem.outlet_id || outletId);
  }
};

const hydrateOutletItemCategories = async (
  outlet: Record<string, any>,
  items: Array<Record<string, any>>
): Promise<Array<Record<string, any>>> => {
  if (!items.length || !isFoodOrBarOutlet(outlet.outlet_type)) return items;

  const group = outletItemGroup(outlet.outlet_type);
  const withOutlet: Array<Record<string, any>> = items.map((item) => ({
    ...item,
    outlet_type: item.outlet_type || outlet.outlet_type
  }));

  const restaurantIds = new Set<string>();
  const barDrinkIds = new Set<string>();
  for (const item of withOutlet) {
    if (item.source_table === 'restaurant_menu_items' || group === 'restaurant') {
      const id = sourceIdForOutletItem(item, 'R-');
      if (id) restaurantIds.add(id);
    }
    if (item.source_table === 'bar_drinks') {
      const id = sourceIdForOutletItem(item, '');
      if (id) barDrinkIds.add(id);
    }
  }

  const restaurantCategoryById = new Map<string, { id: string | null; name: string; sortOrder: number | null }>();
  if (restaurantIds.size) {
    const { data, error } = await supabase
      .from('restaurant_menu_items')
      .select('id, category_id, category:restaurant_menu_categories(id, name, sort_order)')
      .in('id', Array.from(restaurantIds));
    if (error) {
      logger.warn(`Could not hydrate restaurant POS categories: ${error.message}`);
    } else {
      for (const row of (data || []) as Array<Record<string, any>>) {
        const category = row.category as Record<string, any> | null;
        const name = categoryText(category);
        if (name) {
          restaurantCategoryById.set(String(row.id), {
            id: row.category_id ? String(row.category_id) : null,
            name,
            sortOrder: Number.isFinite(Number(category?.sort_order)) ? Number(category?.sort_order) : null
          });
        }
      }
    }
  }

  const barCategoryById = new Map<string, { id: string | null; name: string; sortOrder: number | null }>();
  if (barDrinkIds.size) {
    const { data, error } = await supabase
      .from('bar_drinks')
      .select('id, category_id, category:bar_drink_categories(id, name, sort_order)')
      .in('id', Array.from(barDrinkIds));
    if (error) {
      logger.warn(`Could not hydrate bar POS categories: ${error.message}`);
    } else {
      for (const row of (data || []) as Array<Record<string, any>>) {
        const category = row.category as Record<string, any> | null;
        const name = categoryText(category);
        if (name) {
          barCategoryById.set(String(row.id), {
            id: row.category_id ? String(row.category_id) : null,
            name,
            sortOrder: Number.isFinite(Number(category?.sort_order)) ? Number(category?.sort_order) : null
          });
        }
      }
    }
  }

  return withOutlet.map((item) => {
    const restaurantId = sourceIdForOutletItem(item, 'R-');
    const barDrinkId = sourceIdForOutletItem(item, '');
    const sourceCategory =
      (restaurantId && restaurantCategoryById.get(restaurantId)) ||
      (barDrinkId && barCategoryById.get(barDrinkId));
    return sourceCategory
      ? applySourceCategory(item, sourceCategory.name, sourceCategory.id, sourceCategory.sortOrder)
      : applySourceCategory(item);
  }).sort(sortOutletItems);
};

const seedOutletItemsFromExistingMenus = async (
  outlet: Record<string, any>
): Promise<Array<Record<string, any>>> => {
  const outletType = String(outlet.outlet_type || '');
  const branchId = outlet.branch_id;
  let sourceRows: Array<Record<string, any>> = [];

  // Preserve any manually-set track_stock/current_stock on existing rows instead of
  // resetting them every sync — otherwise a one-off "always available" override
  // would get silently reverted the next time this outlet's items are fetched.
  const { data: existingRows } = await supabase
    .from('pos_outlet_items')
    .select('sku, track_stock, current_stock')
    .eq('outlet_id', outlet.id);
  const existingBySku = new Map(
    (existingRows || []).map((row: any) => [row.sku, row])
  );

  if (outletType === 'restaurant') {
    let query = supabase
      .from('restaurant_menu_items')
      .select('id, name, price, selling_price, cost_price, category_id, category:restaurant_menu_categories(id, name), is_available, is_active, branch_id')
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data, error } = await query;
    if (error) throw error;
    sourceRows = ((data || []) as Array<Record<string, any>>).map((item) => {
      const sku = `R-${item.id}`;
      const existing = existingBySku.get(sku);
      return {
        outlet_id: outlet.id,
        source_table: 'restaurant_menu_items',
        source_item_id: item.id,
        sku,
        name: item.name,
        category: categoryText(item.category) || 'Restaurant',
        unit: 'each',
        cost_price: item.cost_price || 0,
        selling_price: item.price ?? item.selling_price ?? 0,
        opening_stock: 0,
        current_stock: existing?.current_stock ?? 0,
        track_stock: existing?.track_stock ?? true,
        is_active: item.is_active !== false,
        is_available: item.is_available !== false,
        branch_id: item.branch_id ?? outlet.branch_id ?? null
      };
    });
  }

  if (outletType === 'main_bar' || outletType === 'executive_bar' ||
      outletType === 'kyogong_executive_bar' || outletType === 'kyogong_sports_bar') {
    let query = supabase
      .from('bar_drinks')
      .select('id, name, price, selling_price, cost_price, unit, is_available, is_active, branch_id, category_id')
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as Array<Record<string, any>>;
    const categoryIds = [...new Set(rows.map((item) => item.category_id).filter(Boolean))];
    const categoryById = new Map<string, string>();
    if (categoryIds.length) {
      const { data: categories, error: categoryError } = await supabase
        .from('bar_drink_categories')
        .select('id, name')
        .in('id', categoryIds);
      if (categoryError) throw categoryError;
      for (const category of (categories || []) as Array<Record<string, any>>) {
        categoryById.set(String(category.id), String(category.name || 'Bar'));
      }
    }
    const prefix =
      outletType === 'main_bar' ? 'M' :
      outletType === 'executive_bar' ? 'E' :
      outletType === 'kyogong_executive_bar' ? 'KX' : 'KS';
    sourceRows = rows.map((item) => {
      const sku = `${prefix}-${item.id}`;
      const existing = existingBySku.get(sku);
      return {
        outlet_id: outlet.id,
        source_table: 'bar_drinks',
        source_item_id: item.id,
        sku,
        name: item.name,
        category: categoryById.get(String(item.category_id)) ||
          (outletType.includes('executive') ? 'Executive Bar' : 'Main Bar'),
        unit: item.unit || 'each',
        cost_price: item.cost_price || 0,
        selling_price: item.price ?? item.selling_price ?? 0,
        opening_stock: 0,
        current_stock: existing?.current_stock ?? 0,
        track_stock: existing?.track_stock ?? true,
        is_active: item.is_active !== false,
        is_available: item.is_available !== false,
        branch_id: item.branch_id ?? outlet.branch_id ?? null
      };
    });
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

  // Deactivate snapshot rows whose source item no longer exists (deleted/renamed
  // upstream) so removed menu items stop showing up as orderable in POS.
  const sourceTable = sourceRows[0]?.source_table;
  const currentSkus = sourceRows.map((row) => row.sku);
  if (sourceTable && currentSkus.length) {
    await supabase
      .from('pos_outlet_items')
      .update({ is_active: false })
      .eq('outlet_id', outlet.id)
      .eq('source_table', sourceTable)
      .eq('is_active', true)
      .not('sku', 'in', `(${currentSkus.map((sku) => `"${sku}"`).join(',')})`);
  }

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

const enrichOutletItems = (
  outlet: Record<string, any>,
  items: Array<Record<string, any>>
): Array<Record<string, any>> => {
  const group = outletItemGroup(outlet.outlet_type);
  return items.map((item) => ({
    ...item,
    outlet_id: item.outlet_id || outlet.id,
    outlet_name: outlet.name,
    outlet_type: outlet.outlet_type,
    item_group: group,
    item_group_label:
      group === 'restaurant' ? 'Restaurant' :
      group === 'bar' ? 'Bar' :
      'Other',
    category: item.category || (group === 'restaurant' ? 'Restaurant' : group === 'bar' ? 'Bar' : 'Uncategorised')
  }));
};

// Items sharing a stock pool (e.g. Half/Quarter Chicken sharing the Full
// Chicken pool) don't carry their own current_stock — derive what's
// displayed from the pool item's stock divided by this item's fraction.
const applyPoolDerivedStock = (
  items: Array<Record<string, any>>
): Array<Record<string, any>> => {
  const byId = new Map(items.map((it) => [String(it.id), it]));
  return items.map((item) => {
    if (!item.stock_pool_item_id) return item;
    const pool = byId.get(String(item.stock_pool_item_id));
    if (!pool) return item;
    const fraction = numberValue(item.pool_fraction) || 1;
    return {
      ...item,
      current_stock: fraction > 0 ? numberValue(pool.current_stock) / fraction : 0
    };
  });
};

const loadActiveOutletItems = async (
  outlet: Record<string, any>,
  refreshFromSource = false
): Promise<Array<Record<string, any>>> => {
  if (refreshFromSource && isFoodOrBarOutlet(outlet.outlet_type)) {
    const synced = await seedOutletItemsFromExistingMenus(outlet);
    if (synced.length) return synced;
  }

  const { data, error } = await supabase
    .from('pos_outlet_items')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  const items = (data || []) as Array<Record<string, any>>;
  return items.length ? items : await seedOutletItemsFromExistingMenus(outlet);
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
  const sellingPrice = numberValue(
    payload.selling_price ??
    payload.sellingPrice ??
    payload.price ??
    existing?.selling_price
  );
  const isActive = payload.is_active ?? payload.isActive ?? existing?.is_active ?? true;
  const isAvailable = payload.is_available ?? payload.isAvailable ?? existing?.is_available ?? isActive;
  return {
    outlet_id: outletId,
    source_table: payload.source_table ?? existing?.source_table ?? 'manual',
    source_item_id: payload.source_item_id ?? existing?.source_item_id ?? null,
    menu_item_id: payload.menu_item_id ?? payload.menuItemId ?? existing?.menu_item_id ?? null,
    sku,
    name,
    category: payload.category ?? existing?.category ?? 'Manual',
    unit: payload.unit ?? existing?.unit ?? 'each',
    cost_price: numberValue(payload.cost_price ?? payload.costPrice ?? existing?.cost_price),
    selling_price: sellingPrice,
    opening_stock: numberValue(payload.opening_stock ?? payload.openingStock ?? existing?.opening_stock),
    current_stock: numberValue(payload.current_stock ?? payload.currentStock ?? existing?.current_stock),
    track_stock: payload.track_stock ?? payload.trackStock ?? existing?.track_stock ?? true,
    is_active: isActive,
    is_available: isAvailable,
    status: payload.status ?? existing?.status ?? (isActive && isAvailable ? 'active' : 'inactive'),
    branch_id: payload.branch_id ?? payload.branchId ?? existing?.branch_id ?? null,
    updated_at: new Date().toISOString()
  };
};

const syncSourceMenuFromOutletItem = async (
  existing: Record<string, any>,
  row: Record<string, any>
): Promise<void> => {
  const sourceTable = String(existing.source_table || row.source_table || '');
  const sourceItemId = String(
    existing.source_item_id ||
    row.source_item_id ||
    existing.menu_item_id ||
    row.menu_item_id ||
    ''
  );
  if (!sourceItemId) return;

  const patch = {
    name: row.name,
    price: row.selling_price,
    selling_price: row.selling_price,
    cost_price: row.cost_price,
    is_available: row.is_available !== false && row.is_active !== false,
    is_active: row.is_active !== false,
    updated_at: new Date().toISOString()
  };

  if (sourceTable === 'restaurant_menu_items') {
    const { error } = await supabase
      .from('restaurant_menu_items')
      .update(patch)
      .eq('id', sourceItemId);
    if (error) throw error;
  }

  if (sourceTable === 'bar_drinks') {
    const { error } = await supabase
      .from('bar_drinks')
      .update(patch)
      .eq('id', sourceItemId);
    if (error) throw error;
  }
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
    await syncSourceMenuFromOutletItem(existing, data as Record<string, any>);
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

// @desc    Check whether the till/kitchen thermal printer service is reachable
//          and configured — lets staff verify auto-print before relying on it.
// @route   GET /pos/printer/status
export const getPrinterStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { captainOrderPrintService } = await import('../services/captainOrderPrint.service');
    const configured = await captainOrderPrintService.checkPrinterStatus();
    res.json({
      success: true,
      data: {
        printer_service_reachable: configured,
        python_service_url: process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com'
      }
    });
  } catch (error) {
    next(error);
  }
};

const captainOrderNormalizeStatus = (value: any): string => {
  const status = String(value || 'pending').toLowerCase();
  return ['pending', 'confirmed'].includes(status) ? 'pending' : status;
};

const captainOrderItemKey = (item: any, index: number): string => {
  const base = String(item?.outlet_item_id || item?.id || item?.menu_item_id || item?.sku || item?.name || 'item');
  const recallBatch = item?.recall_batch_id ? `:${item.recall_batch_id}` : '';
  return `${base}${recallBatch}:${index}`;
};

const captainOrderActiveStatuses = new Set(['pending', 'preparing', 'ready', 'recalled', 'void_requested', 'cancelled', 'voided']);
const CAPTAIN_ORDER_FEED_LOOKBACK_HOURS = 36;

// True once captain_printed_at covers the order's current state: for a
// recalled order that means printed at/after the latest recall, not just
// printed at some point in the past (an older creation-time print doesn't
// count for a newer recall). KDS/cashier backup polling uses this to skip
// reprinting an order that's already been ticketed, instead of relying on
// in-memory dedup that's lost whenever the screen remounts (e.g. logout).
const isCaptainOrderAlreadyPrinted = (order: any, items: Array<Record<string, any>>): boolean => {
  if (!order?.captain_printed_at) return false;
  const printedAt = new Date(order.captain_printed_at).getTime();
  if (!Number.isFinite(printedAt)) return false;
  const latestRecalledAt = items
    .filter((item) => item?.is_recalled_item)
    .map((item) => new Date(item?.recalled_at || 0).getTime())
    .filter((time) => Number.isFinite(time))
    .reduce((max, time) => Math.max(max, time), 0);
  if (!latestRecalledAt) return true;
  return printedAt >= latestRecalledAt;
};

// Feeds Main Bar / Executive Bar captain orders (new + recalled) to the
// Cashier station module, mirroring the restaurant KDS feed at
// GET /restaurant/kitchen/orders so the cashier can auto-print a copy
// alongside the bar ticket without waiting on the customer bill.
export const getBarCaptainOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const branchId = branchIdFor(req);
    const lookbackSince = new Date(Date.now() - CAPTAIN_ORDER_FEED_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

    let shiftQuery = supabase
      .from('pos_outlet_shifts')
      .select('id, branch_id, outlet_id, status, opened_at, outlet:pos_outlets(name, outlet_type)')
      .or(`status.eq.open,opened_at.gte.${lookbackSince}`)
      .order('opened_at', { ascending: false })
      .limit(250);

    if (branchId) shiftQuery = shiftQuery.eq('branch_id', branchId);

    const { data: outletShifts, error: shiftError } = await shiftQuery;
    if (shiftError) throw shiftError;

    const barShiftIds = (outletShifts || [])
      .filter((shift: any) => {
        const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
        return BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES.has(String(outlet?.outlet_type || '') as OutletType);
      })
      .map((shift: any) => shift.id);
    const shiftsById = new Map((outletShifts || []).map((shift: any) => [shift.id, shift]));

    let barOrders: any[] = [];
    if (barShiftIds.length) {
      const { data: posOrders, error: posOrdersError } = await supabase
        .from('pos_shift_orders')
        .select('*')
        .in('shift_id', barShiftIds)
        .or('status.eq.open,status.eq.voided,payment_status.eq.voided,void_request_status.in.(pending,approved),kitchen_status.in.(void_requested,cancelled,voided,pending,preparing,ready,recalled)')
        .order('created_at', { ascending: true });

      if (posOrdersError) throw posOrdersError;

      barOrders = (posOrders || []).map((order: any) => {
        const shift = shiftsById.get(order.shift_id) || {};
        const shiftOutlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
        const orderItems = Array.isArray(order.items) ? order.items : [];
        return {
          id: `pos:${order.id}`,
          source: 'pos_shift_order',
          source_id: order.id,
          order_number: order.order_number,
          short_code: order.short_code,
          branch_id: shift.branch_id,
          outlet_id: order.outlet_id,
          outlet_type: shiftOutlet?.outlet_type || null,
          outlet_name: shiftOutlet?.name || null,
          shift_id: order.shift_id,
          order_type: order.order_type || 'bar',
          table_number: order.table_number ?? null,
          room_number: order.room_number ?? null,
          waiter_name: order.waiter_name,
          customer_name: order.customer_name || 'Walk-in',
          status: captainOrderNormalizeStatus(order.kitchen_status || order.status),
          order_status: order.status,
          payment_status: order.payment_status,
          void_request_status: order.void_request_status,
          void_reason: order.void_reason,
          voided_at: order.voided_at,
          voided_by: order.voided_by,
          created_at: order.created_at,
          elapsed_minutes: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000),
          items_count: orderItems.length,
          total: order.total_amount,
          total_amount: order.total_amount,
          captain_order_already_printed: isCaptainOrderAlreadyPrinted(order, orderItems),
          items: orderItems.map((item: any, index: number) => {
            const itemStatus = captainOrderNormalizeStatus(item.kitchen_status || item.status || order.kitchen_status);
            return {
              id: captainOrderItemKey(item, index),
              name: item.name || item.item_name || 'Bar item',
              quantity: Number(item.quantity || item.qty || 1),
              unit_price: Number(item.unit_price || item.price || 0),
              notes: item.notes,
              is_recalled_item: item.is_recalled_item === true,
              recall_batch_id: item.recall_batch_id || null,
              recalled_at: item.recalled_at || null,
              recall_note: item.recall_note || null,
              status: itemStatus,
              is_ready: itemStatus === 'ready'
            };
          })
        };
      }).filter((order: any) => captainOrderActiveStatuses.has(captainOrderNormalizeStatus(order.status)));
    }

    res.json({ success: true, data: barOrders });
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
      if (branchId === null) {
        res.json({ success: true, data: [] });
        return;
      }
      query = query.eq('branch_id', branchId);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', Number(req.query.branch_id));
    }

    const { data, error } = await query;
    if (error) throw error;

    const role = roleFor(req);
    const assignedOutlets = await loadAssignedPosOutlets(supabase, req.user?.id);
    const ids = assignedOutletIds(assignedOutlets);
    let rows = ((data || []) as Array<Record<string, any>>);
    if (shouldRestrictCashierStationAccess(role, ids)) {
      const roleOutletTypes = stationTypesForCashierRole(role);
      rows = rows.filter((outlet) =>
        ids.includes(String(outlet.id)) ||
        roleOutletTypes.includes(String(outlet.outlet_type || '').toLowerCase())
      );
    }
    rows = await removeCrossBranchOutletLeaks(rows);

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const getOutletItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outletId } = req.params;
    const includeRelated = ['true', '1', 'branch_food_bar', 'food_bar']
      .includes(String(req.query.include_related ?? req.query.unified ?? '').toLowerCase());
    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    await ensureCashierOutletAccess(req, outlet);

    if (includeRelated && isFoodOrBarOutlet(outlet.outlet_type)) {
      const { data: outlets, error: outletsError } = await supabase
        .from('pos_outlets')
        .select('*')
        .eq('branch_id', outlet.branch_id)
        .eq('is_active', true)
        .in('outlet_type', Array.from(FOOD_AND_BAR_OUTLET_TYPES))
        .order('outlet_type', { ascending: true })
        .order('name', { ascending: true });
      if (outletsError) throw outletsError;

      const merged: Array<Record<string, any>> = [];
      for (const branchOutlet of (outlets || []) as Array<Record<string, any>>) {
        const items = applyPoolDerivedStock(await loadActiveOutletItems(branchOutlet, true));
        const categorisedItems = await hydrateOutletItemCategories(branchOutlet, items);
        merged.push(...enrichOutletItems(branchOutlet, categorisedItems));
      }

      merged.sort(sortOutletItems);

      res.json({ success: true, data: merged });
      return;
    }

    const items = await hydrateOutletItemCategories(
      outlet,
      applyPoolDerivedStock(await loadActiveOutletItems(outlet, true))
    );
    res.json({
      success: true,
      data: enrichOutletItems(outlet, items)
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
      .select('id, first_name, last_name, national_id, employee_number, role, department, branch_id')
      .order('first_name', { ascending: true })
      .limit(100);

    if (!isGlobalUser(req)) {
      if (branchId === null) {
        res.json({ success: true, data: [] });
        return;
      }
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
          staff.national_id,
          staff.employee_number,
          staff.role,
          staff.department
        ].join(' ').toLowerCase();
        return text.includes(search);
      })
      .map((staff) => ({
        id: staff.id,
        name: `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.employee_number || staff.id,
        id_number: staff.national_id,
        employee_number: staff.employee_number,
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
    await ensureCashierOutletAccess(req, outlet);

    let { data, error } = await supabase
      .from('pos_outlet_shifts')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    // Bridge (per-station): this station's POS is "open" only when a cashier
    // whose role serves THIS station type (e.g. main_bar_cashier → main_bar)
    // has an open shift (cashier_shift_logs). When they do, open the station's
    // POS shift so waiters can order against it. No matching cashier shift →
    // stays closed (waiters can't order, and can't open a shift themselves).
    if (!data) {
      const { data: branchShifts } = await supabase
        .from('cashier_shift_logs')
        .select('id, cashier_id')
        .eq('branch_id', outlet.branch_id)
        .eq('status', 'open');
      const cashierIds = (branchShifts || [])
        .map((s: any) => s.cashier_id)
        .filter(Boolean);
      if (cashierIds.length) {
        const { data: users } = await supabase
          .from('users')
          .select('id, role')
          .in('id', cashierIds);
        const roleById = new Map((users || []).map((u: any) => [u.id, u.role]));
        const outletType = String(outlet.outlet_type || '').toLowerCase();
        const match = (branchShifts || []).find((s: any) =>
          stationTypesForCashierRole(roleById.get(s.cashier_id)).includes(outletType));
        if (match) {
          const { data: created, error: createErr } = await supabase
            .from('pos_outlet_shifts')
            .insert({
              outlet_id: outletId,
              branch_id: outlet.branch_id,
              cashier_id: match.cashier_id,
              opening_float: 0,
              status: 'open',
            })
            .select('*')
            .single();
          if (createErr) throw createErr;
          data = created;
        }
      }
    }

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
    // Only a cashier (or a manager opening on a cashier's behalf) may open a
    // POS shift. Waiters can never open a shift — they place orders against
    // the cashier's open shift.
    const openerRole = roleFor(req);
    if (!isCashierStationRole(openerRole) &&
        !SHIFT_MANAGER_ROLES.has(openerRole) &&
        !isGlobalUser(req)) {
      throw new AppError(
        'Only the station cashier can open a shift. Waiters place orders against the cashier\'s open shift.',
        403,
      );
    }
    const { outletId } = req.params;
    const openingFloat = numberValue(req.body.opening_float);
    const requestedCashierId = nullableText(req.body.cashier_id ?? req.body.cashierId);
    const canOpenForCashier = MANAGE_OUTLET_ROLES.has(roleFor(req));
    const targetCashierId = canOpenForCashier && requestedCashierId
      ? requestedCashierId
      : String(req.user.id);

    const { data: outlet, error: outletError } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', outletId)
      .single();
    if (outletError || !outlet) throw new AppError('POS outlet not found', 404);
    await ensureCashierOutletAccess(req, outlet);

    const { data: existing, error: existingError } = await supabase
      .from('pos_outlet_shifts')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('status', 'open')
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw new AppError('This outlet already has an open shift', 409);

    if (targetCashierId !== String(req.user.id)) {
      const { data: cashier, error: cashierError } = await supabase
        .from('users')
        .select('id, branch_id, role')
        .eq('id', targetCashierId)
        .maybeSingle();
      if (cashierError) throw cashierError;
      if (!cashier) throw new AppError('Selected cashier was not found', 404);
      if (cashier.branch_id && Number(cashier.branch_id) !== Number(outlet.branch_id)) {
        throw new AppError('Selected cashier does not belong to this outlet branch', 403);
      }
    }

    const { data: shift, error: shiftError } = await supabase
      .from('pos_outlet_shifts')
      .insert({
        outlet_id: outletId,
        branch_id: outlet.branch_id,
        cashier_id: targetCashierId,
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

    ensureShiftAutomationOpened(shift.id, targetCashierId)
      .catch((error) => logger.warn('Unable to record shift open automation marker', error));

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
    let query = supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('shift_id', shiftId)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false });
    if (shouldScopeOrdersToOwner(req)) {
      query = query.or(`waiter_id.eq.${req.user.id},created_by.eq.${req.user.id}`);
    } else if (req.query.waiter_id) {
      query = query.eq('waiter_id', String(req.query.waiter_id));
    }
    const { data, error } = await query;
    if (error) throw error;

    // A bill that already has a pending or approved exchange request must not
    // accept another one — surfaced here so the waiter's "Request Exchange"
    // action can be disabled without a second round trip per order.
    const orderIds = (data || []).map((order: any) => order.id);
    const activeExchangeOrderIds = new Set<string>();
    if (orderIds.length) {
      const { data: exchangeRows, error: exchangeError } = await supabase
        .from('pos_item_exchange_requests')
        .select('order_id')
        .in('order_id', orderIds)
        .in('status', ['pending', 'approved']);
      if (exchangeError) {
        console.warn('Failed to fetch active exchange requests for order list:', exchangeError.message);
      } else {
        for (const row of (exchangeRows || [])) activeExchangeOrderIds.add(row.order_id);
      }
    }

    const enriched = (data || []).map((order: any) => ({
      ...order,
      has_active_exchange_request: activeExchangeOrderIds.has(order.id)
    }));

    res.json({ success: true, data: enriched });
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

    const normalizedItems = await normalizeOrderItems(shift.outlet_id, items);
    await assertPosStockAvailable(Number(shift.branch_id), shift.outlet_id, normalizedItems);

    const totalAmount = numberValue(req.body.total_amount) ||
      normalizedItems.reduce((sum, item) => sum + numberValue(item.line_total), 0);
    const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
    const context = orderContextPatch(req.body, null, outlet?.outlet_type);

    const { data: order, error } = await supabase
      .from('pos_shift_orders')
      .insert({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        branch_id: shift.branch_id,
        source_type: req.body.source_type || 'manual',
        source_id: req.body.source_id || null,
        order_number: req.body.order_number || `POS-${Date.now()}`,
        customer_name: req.body.customer_name || 'Walk-in',
        ...context,
        waiter_id: req.body.waiter_id || req.user.id,
        waiter_name: req.body.waiter_name ||
          `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() ||
          null,
        status: 'open',
        kitchen_status: 'pending',
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

    const verification = await createBillVerificationCode({
      code: order.short_code,
      billRef: String(order.order_number || order.id),
      billType: billTypeForOutlet(outlet?.outlet_type),
      branchId: Number(shift.branch_id),
      outletId: shift.outlet_id,
      amount: totalAmount,
      generatedBy: String(req.user.id),
      notes: 'Generated from POS outlet bill creation',
      metadata: {
        source_table: 'pos_shift_orders',
        source_id: order.id,
        shift_id: shiftId,
        outlet_type: outlet?.outlet_type || null,
        customer_name: order.customer_name || null
      }
    });

    if (verification?.code && verification.code !== order.short_code) {
      order.short_code = verification.code;
      await supabase
        .from('pos_shift_orders')
        .update({ short_code: verification.code, updated_at: new Date().toISOString() })
        .eq('id', order.id);
    }

    await updateStockForItems(shiftId, shift.outlet_id, normalizedItems, 1);
    
    // Captain order printing is entirely the cashier app's job now (this
    // backend never attempts its own cloud-side print, see the comment
    // above BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES near the top of this
    // file). Main Bar / Executive Bar: the cashier screen's own
    // getBarCaptainOrders poll prints this order locally and calls
    // markCaptainOrderPrinted itself. Restaurant: outlet_pos_screen.dart
    // prints the kitchen ticket locally right after creating the order.

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const getShiftOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    await ensureShiftAccess(req, shiftId);
    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// Lets a backup printer (cashier-station bar feed, KDS) report that it has
// already printed an order's current state, so captain_printed_at is set
// even when the backend's own auto-print attempt failed but the client's
// succeeded. Without this, the only path that ever marks an order "printed"
// is the backend's own immediate attempt at creation/recall.
export const markCaptainOrderPrinted = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    await ensureShiftAccess(req, shiftId);
    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);
    const { error } = await supabase
      .from('pos_shift_orders')
      .update({ captain_printed_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// A waiter/cashier may print the customer bill normally once (that happens
// automatically on order creation/recall, not through this endpoint), and
// then exactly one duplicate via the explicit "Reprint bill" action. This
// checks-and-increments bill_reprint_count atomically server-side so the
// limit survives logout/login and can't be bypassed by retrying client-side.
export const reprintShiftOrderBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    await ensureShiftAccess(req, shiftId);
    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);

    const currentCount = Number(order.bill_reprint_count || 0);
    if (currentCount >= 1) {
      throw new AppError('Reprint limit reached. Only one duplicate bill is allowed.', 409);
    }

    const { data, error } = await supabase
      .from('pos_shift_orders')
      .update({ bill_reprint_count: currentCount + 1 })
      .eq('id', orderId)
      .eq('shift_id', shiftId)
      .eq('bill_reprint_count', currentCount) // optimistic lock against a concurrent reprint racing this one
      .select('bill_reprint_count')
      .single();
    if (error || !data) {
      throw new AppError('Reprint limit reached. Only one duplicate bill is allowed.', 409);
    }

    res.json({ success: true, data: { bill_reprint_count: data.bill_reprint_count } });
  } catch (error) {
    next(error);
  }
};

export const updateShiftOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    if (shift.status !== 'open') throw new AppError('Bills can only be recalled on an open shift', 400);

    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);
    ensureEditableOrder(order, 'recall');

    const items = Array.isArray(req.body.items) ? req.body.items as Array<Record<string, any>> : [];
    if (!items.length) throw new AppError('At least one item is required', 400);
    const appendItems = req.body.append_items === true || req.body.appendOnly === true || req.body.mode === 'append';
    const existingItems = Array.isArray(order.items) ? order.items as Array<Record<string, any>> : [];
    const recalledAt = new Date().toISOString();
    const recallBatchId = `recall-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalizedItems = (await normalizeOrderItems(shift.outlet_id, items)).map((item: any) => ({
      ...item,
      is_recalled_item: true,
      recall_batch_id: recallBatchId,
      recalled_at: recalledAt,
      recall_note: 'RECALLED BILL',
      kitchen_status: 'recalled'
    }));
    const nextItems = appendItems ? [...existingItems, ...normalizedItems] : normalizedItems;
    await assertPosStockAvailable(Number(shift.branch_id), shift.outlet_id, appendItems ? normalizedItems : nextItems);
    const totalAmount = orderItemsTotal(nextItems);
    const amountPaid = numberValue(order.amount_paid);
    if (totalAmount + 0.01 < amountPaid) {
      throw new AppError('Recalled bill total cannot be less than the amount already paid', 400);
    }

    if (!appendItems) {
      await updateStockForItems(shiftId, shift.outlet_id, existingItems, -1);
    }
    await updateStockForItems(shiftId, shift.outlet_id, normalizedItems, 1);
    const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
    const context = orderContextPatch(req.body, order, outlet?.outlet_type);

    const { data, error } = await supabase
      .from('pos_shift_orders')
      .update({
        customer_name: req.body.customer_name || order.customer_name || 'Walk-in',
        ...context,
        total_amount: totalAmount,
        balance_amount: Math.max(0, totalAmount - amountPaid),
        payment_status: amountPaid > 0 ? 'partial' : 'unpaid',
        status: 'open',
        kitchen_status: 'recalled',
        kitchen_started_at: recalledAt,
        kitchen_ready_at: recalledAt,
        void_request_status: null,
        items: nextItems,
        // The bill genuinely changed — give it a fresh reprint allowance
        // rather than carrying over a duplicate already used against the
        // pre-recall version of this order.
        bill_reprint_count: 0,
        updated_at: recalledAt
      })
      .eq('id', orderId)
      .eq('shift_id', shiftId)
      .select('*')
      .single();
    if (error || !data) throw error || new AppError('Failed to update recalled bill', 500);

    // Recalled items still get a captain ticket, but this backend doesn't
    // print it (this backend never attempts its own cloud-side print, see
    // the comment above BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES near the top
    // of this file). The order is marked 'recalled' (not 'served') so it
    // still shows on the KDS digital display with a RECALL badge until
    // kitchen/bar staff dismiss it. Main Bar / Executive Bar:
    // getBarCaptainOrders poll prints it locally. Restaurant:
    // outlet_pos_screen.dart prints it locally right after this call
    // returns (see _printKitchenCaptainOrder, isRecall: true).

    // The consolidated bill for this recall (nextItems / data.items) is
    // printed locally by the cashier app from this response's `data` (see
    // outlet_pos_screen.dart's _printCustomerBillFromSavedOrder), not by
    // this backend. This backend and python-services both run on Render's
    // cloud infrastructure with no network path to a branch's USB/LAN till
    // printer, so a cloud print attempt here can never succeed — it would
    // only produce log noise (see the identical fix applied to
    // captain-order printing above).

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const splitShiftOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    if (shift.status !== 'open') throw new AppError('Bills can only be split on an open shift', 400);

    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);
    ensureEditableOrder(order, 'split');
    const items = Array.isArray(order.items) ? order.items as Array<Record<string, any>> : [];
    const splits = Array.isArray(req.body.splits) ? req.body.splits as Array<Record<string, any>> : [];
    if (splits.length < 2) throw new AppError('At least two split bills are required', 400);

    const usedIndexes = new Set<number>();
    const childRows: Array<Record<string, any>> = [];
    const splitServedAt = new Date().toISOString();
    const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;

    for (const split of splits) {
      const indexes = Array.isArray(split.item_indexes) ? split.item_indexes.map((i: unknown) => Number(i)) : [];
      if (!indexes.length) throw new AppError('Each split must include at least one item', 400);
      const splitItems = indexes.map((index) => {
        if (!Number.isInteger(index) || index < 0 || index >= items.length) {
          throw new AppError('Split contains an invalid item selection', 400);
        }
        if (usedIndexes.has(index)) throw new AppError('An item cannot be assigned to more than one split', 400);
        usedIndexes.add(index);
        return items[index];
      });
      const totalAmount = splitItems.reduce((sum, item) => sum + numberValue(item.line_total), 0);
      const splitItemsWithStatus = splitItems.map((item: any) => ({ ...item, kitchen_status: 'served' }));
      childRows.push({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        branch_id: shift.branch_id,
        source_type: 'manual',
        source_id: order.id,
        order_number: `${order.order_number || 'POS'}-${childRows.length + 1}`,
        customer_name: split.customer_name || order.customer_name || 'Walk-in',
        order_type: order.order_type || null,
        table_number: order.table_number || null,
        room_number: order.room_number || null,
        waiter_id: order.waiter_id || req.user.id,
        waiter_name: order.waiter_name ||
        `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || null,
        status: 'open',
        kitchen_status: 'served',
        kitchen_started_at: splitServedAt,
        kitchen_ready_at: splitServedAt,
        kitchen_served_at: splitServedAt,
        payment_status: 'unpaid',
        total_amount: totalAmount,
        amount_paid: 0,
        balance_amount: totalAmount,
        items: splitItemsWithStatus,
        split_parent_order_id: order.id,
        split_type: 'by_items',
        created_by: req.user.id
      });
    }

    if (usedIndexes.size !== items.length) throw new AppError('Every item must be assigned to a split bill', 400);

    // NOT 'cancelled' for kitchen_status — isKitchenVisiblePosOrder() treats
    // kitchen_status 'cancelled'/'voided' as a void notice worth showing on
    // KDS. A split isn't a kitchen-relevant void (the food was already made
    // under the original ticket), so the parent uses the same hidden state
    // as the child orders ('served'). All child inserts + the parent update
    // happen in one DB transaction via the RPC so a failure partway through
    // cannot leave orphaned child bills alongside a still-open parent.
    const { data: childOrders, error: splitError } = await supabase
      .rpc('split_pos_shift_order', {
        p_order_id: orderId,
        p_shift_id: shiftId,
        p_children: childRows
      });
    if (splitError) throw splitError;
    if (!Array.isArray(childOrders) || childOrders.length !== childRows.length) {
      throw new AppError('Failed to create split bills', 500);
    }

    for (const child of childOrders) {
      const verification = await createBillVerificationCode({
        code: child.short_code,
        billRef: String(child.order_number || child.id),
        billType: billTypeForOutlet(outlet?.outlet_type),
        branchId: Number(shift.branch_id),
        outletId: shift.outlet_id,
        amount: numberValue(child.total_amount),
        generatedBy: String(req.user.id),
        notes: 'Generated from POS split bill creation',
        metadata: {
          source_table: 'pos_shift_orders',
          source_id: child.id,
          split_parent_order_id: order.id,
          shift_id: shiftId,
          outlet_type: outlet?.outlet_type || null
        }
      });

      if (verification?.code && verification.code !== child.short_code) {
        child.short_code = verification.code;
        await supabase
          .from('pos_shift_orders')
          .update({ short_code: verification.code, updated_at: new Date().toISOString() })
          .eq('id', child.id);
      }
    }

    // Split-bill receipts are printed locally by the cashier app from this
    // response's childOrders (see outlet_pos_screen.dart's
    // _showSplitOrderDialog), not by this backend. This backend and
    // python-services both run on Render's cloud infrastructure with no
    // network path to a branch's USB/LAN till printer, so a cloud print
    // attempt here can never succeed — it would only produce log noise
    // (see the identical fix applied to captain-order printing above).
    res.status(201).json({ success: true, data: childOrders });
  } catch (error) {
    next(error);
  }
};

export const mergeShiftOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    const shift = await ensureShiftAccess(req, shiftId);
    if (shift.status !== 'open') throw new AppError('Bills can only be merged on an open shift', 400);

    const orderIds = Array.isArray(req.body.order_ids) ? req.body.order_ids.map((id: unknown) => String(id)) : [];
    if (orderIds.length < 2) throw new AppError('At least two bills are required to merge', 400);

    const { data: orders, error } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('shift_id', shiftId)
      .in('id', orderIds);
    if (error) throw error;
    if (!orders || orders.length !== orderIds.length) throw new AppError('One or more bills were not found', 404);
    orders.forEach((order: any) => ensureOrderOwnerAccess(req, order));
    orders.forEach((order: any) => ensureEditableOrder(order, 'merge'));

    const mergedItems = orders.flatMap((order: any) => Array.isArray(order.items) ? order.items : []);
    const totalAmount = mergedItems.reduce((sum: number, item: any) => sum + numberValue(item.line_total), 0);
    const customerName = req.body.customer_name || orders.map((order: any) => order.customer_name).filter(Boolean).join(' / ') || 'Merged bill';
    const firstContextOrder = orders[0] as Record<string, any>;
    const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
    const context = orderContextPatch(req.body, firstContextOrder, outlet?.outlet_type);

    const { data: target, error: targetError } = await supabase
      .from('pos_shift_orders')
      .insert({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        branch_id: shift.branch_id,
        source_type: 'manual',
        order_number: req.body.order_number || `MERGE-${Date.now()}`,
        customer_name: customerName,
        ...context,
        waiter_id: req.user.id,
        waiter_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || null,
        status: 'open',
        kitchen_status: 'pending',
        payment_status: 'unpaid',
        total_amount: totalAmount,
        amount_paid: 0,
        balance_amount: totalAmount,
        items: mergedItems,
        created_by: req.user.id
      })
      .select('*')
      .single();
    if (targetError || !target) throw targetError || new AppError('Failed to create merged bill', 500);

    const verification = await createBillVerificationCode({
      code: target.short_code,
      billRef: String(target.order_number || target.id),
      billType: billTypeForOutlet(outlet?.outlet_type),
      branchId: Number(shift.branch_id),
      outletId: shift.outlet_id,
      amount: totalAmount,
      generatedBy: String(req.user.id),
      notes: 'Generated from POS merged bill creation',
      metadata: {
        source_table: 'pos_shift_orders',
        source_id: target.id,
        merged_source_order_ids: orderIds,
        shift_id: shiftId,
        outlet_type: outlet?.outlet_type || null
      }
    });

    if (verification?.code && verification.code !== target.short_code) {
      target.short_code = verification.code;
      await supabase
        .from('pos_shift_orders')
        .update({ short_code: verification.code, updated_at: new Date().toISOString() })
        .eq('id', target.id);
    }

    const { error: sourceUpdateError } = await supabase
      .from('pos_shift_orders')
      .update({
        is_merged: true,
        merged_into: target.id,
        status: 'voided',
        kitchen_status: 'cancelled',
        payment_status: 'voided',
        balance_amount: 0,
        updated_at: new Date().toISOString()
      })
      .in('id', orderIds);
    if (sourceUpdateError) throw sourceUpdateError;

    res.status(201).json({ success: true, data: target });
  } catch (error) {
    next(error);
  }
};

export const requestVoidShiftOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    const reason = String(req.body.reason || '').trim();
    
    logger.info(`Void request initiated - shiftId: ${shiftId}, orderId: ${orderId}, userId: ${req.user.id}`);
    
    if (!reason) throw new AppError('Void reason is required', 400);
    
    const shift = await ensureShiftAccess(req, shiftId);
    logger.info(`Shift validated - outlet_id: ${shift.outlet_id}, branch_id: ${shift.branch_id}`);
    
    const order = await loadShiftOrder(shiftId, orderId);
    logger.info(`Order loaded - order_number: ${order.order_number}, payment_status: ${order.payment_status}, status: ${order.status}`);
    
    ensureOrderOwnerAccess(req, order);
    ensureEditableOrder(order, 'void');

    const { data: existing, error: existingError } = await supabase
      .from('pos_void_requests')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingError) {
      logger.error('Error checking existing void requests:', existingError);
      throw existingError;
    }
    if (existing) {
      logger.warn(`Duplicate void request detected for order: ${orderId}`);
      throw new AppError('A pending void request already exists for this bill', 409);
    }

    const { data: requestRow, error } = await supabase
      .from('pos_void_requests')
      .insert({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        order_id: orderId,
        order_number: order.order_number,
        branch_id: shift.branch_id,
        requested_by: req.user.id,
        reason,
        status: 'pending'
      })
      .select('*')
      .single();
    if (error || !requestRow) {
      logger.error('Failed to create void request:', error);
      throw error || new AppError('Failed to create void request', 500);
    }
    
    logger.info(`Void request created - request_id: ${requestRow.id}`);

    const voidRequestedItems = Array.isArray(order.items)
      ? order.items.map((item: any) => ({ ...item, kitchen_status: 'void_requested' }))
      : order.items;

    const { error: updateError } = await supabase
      .from('pos_shift_orders')
      .update({
        void_request_status: 'pending',
        kitchen_status: 'void_requested',
        items: voidRequestedItems,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);
      
    if (updateError) {
      logger.error('Failed to update order status:', updateError);
      throw updateError;
    }
    
    logger.info(`Order status updated - void_request_status: pending, kitchen_status: void_requested`);

    await notificationService.notifyRole(
      'branch_accountant',
      'POS void approval required',
      `${order.order_number || 'A POS bill'} needs void approval.`,
      {
        type: 'warning',
        category: 'pos_void_request',
        priority: 'high',
        branchId: shift.branch_id,
        metadata: { request_id: requestRow.id, order_id: orderId, shift_id: shiftId }
      }
    );

    await notificationService.notifyRole(
      'branch_manager',
      'POS void request raised',
      `${order.order_number || 'A POS bill'} has been stopped at the POS station and needs review.`,
      {
        type: 'warning',
        category: 'pos_void_request',
        priority: 'high',
        branchId: shift.branch_id,
        metadata: {
          request_id: requestRow.id,
          order_id: orderId,
          shift_id: shiftId,
          kitchen_status: 'void_requested'
        }
      }
    );

    await notificationService.notifyRole(
      'auditor',
      'POS void request raised',
      `${order.order_number || 'A POS bill'} is awaiting branch accountant void approval.`,
      {
        type: 'warning',
        category: 'pos_void_request',
        priority: 'high',
        branchId: shift.branch_id,
        metadata: {
          request_id: requestRow.id,
          order_id: orderId,
          shift_id: shiftId,
          kitchen_status: 'void_requested'
        }
      }
    );
    
    logger.info(`Void request completed successfully - request_id: ${requestRow.id}`);

    res.status(201).json({ success: true, data: requestRow });
  } catch (error) {
    logger.error('Void request failed:', error);
    next(error);
  }
};

export const getPendingPosVoidRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) throw new AppError('Forbidden: accountant approval required', 403);
    let query = supabase
      .from('pos_void_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : branchIdFor(req);
    if (!isGlobalUser(req)) {
      if (branchId === null) {
        res.json({ success: true, data: [] });
        return;
      }
      query = query.eq('branch_id', branchId);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', Number(req.query.branch_id));
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const orderIds = [...new Set(rows.map((row: any) => row.order_id).filter(Boolean))];
    const outletIds = [...new Set(rows.map((row: any) => row.outlet_id).filter(Boolean))];
    const branchIds = [...new Set(rows.map((row: any) => row.branch_id).filter(Boolean))];
    const userIds = [...new Set(rows.map((row: any) => row.requested_by).filter(Boolean))];

    const [ordersResult, outletsResult, branchesResult, usersResult] = await Promise.all([
      orderIds.length
        ? supabase.from('pos_shift_orders').select('id, order_number, customer_name, total_amount, amount_paid, balance_amount').in('id', orderIds)
        : Promise.resolve({ data: [], error: null }),
      outletIds.length
        ? supabase.from('pos_outlets').select('id, name').in('id', outletIds)
        : Promise.resolve({ data: [], error: null }),
      branchIds.length
        ? supabase.from('branches').select('id, name').in('id', branchIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabase.from('users').select('id, email, first_name, last_name').in('id', userIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (outletsResult.error) throw outletsResult.error;
    if (branchesResult.error) throw branchesResult.error;
    if (usersResult.error) throw usersResult.error;

    const ordersById = new Map((ordersResult.data || []).map((order: any) => [order.id, order]));
    const outletsById = new Map((outletsResult.data || []).map((outlet: any) => [outlet.id, outlet]));
    const branchesById = new Map((branchesResult.data || []).map((branch: any) => [branch.id, branch]));
    const usersById = new Map((usersResult.data || []).map((user: any) => [user.id, user]));
    const enriched = rows.map((row: any) => {
      const order = ordersById.get(row.order_id) || {};
      const outlet = outletsById.get(row.outlet_id) || {};
      const branch = branchesById.get(row.branch_id) || {};
      const user = usersById.get(row.requested_by) || {};
      const requestedByName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      return {
        ...row,
        order_number: row.order_number || order.order_number,
        customer_name: order.customer_name,
        total_amount: order.total_amount,
        amount_paid: order.amount_paid,
        balance_amount: order.balance_amount,
        outlet_name: outlet.name,
        branch_name: branch.name,
        requested_by_email: user.email,
        requested_by_name: requestedByName || user.email
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

export const reviewPosVoidRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) throw new AppError('Forbidden: accountant approval required', 403);
    const { requestId } = req.params;
    const approved = req.body.approved === true || req.body.action === 'approve';
    const rejectionReason = String(req.body.rejection_reason || req.body.reason || '').trim();

    const { data: requestRow, error } = await supabase
      .from('pos_void_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    if (requestRow.status !== 'pending') throw new AppError('Void request already processed', 400);
    ensureBranchAccess(req, requestRow.branch_id);

    const order = await loadShiftOrder(requestRow.shift_id, requestRow.order_id);

    const { error: updateRequestError } = await supabase
      .from('pos_void_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: approved ? null : rejectionReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
    if (updateRequestError) throw updateRequestError;

    if (approved) {
      await updateStockForItems(requestRow.shift_id, requestRow.outlet_id, Array.isArray(order.items) ? order.items : [], -1);
      if (order.inventory_posted_at && !order.inventory_reversed_at) {
        await postPosInventorySale({
          branchId: Number(requestRow.branch_id),
          outletId: requestRow.outlet_id,
          shiftId: requestRow.shift_id,
          orderId: requestRow.order_id,
          items: Array.isArray(order.items) ? order.items : [],
          actorId: req.user.id,
          reverse: true
        });
      }
      const voidedItems = Array.isArray(order.items)
        ? order.items.map((item: any) => ({ ...item, kitchen_status: 'voided' }))
        : order.items;
      const { error: voidOrderError } = await supabase
        .from('pos_shift_orders')
        .update({
          status: 'voided',
          payment_status: 'voided',
          kitchen_status: 'voided',
          items: voidedItems,
          balance_amount: 0,
          void_request_status: 'approved',
          voided_at: new Date().toISOString(),
          voided_by: req.user.id,
          void_reason: requestRow.reason,
          inventory_reversed_at: order.inventory_posted_at ? new Date().toISOString() : order.inventory_reversed_at || null,
          inventory_reversed_by: order.inventory_posted_at ? req.user.id : order.inventory_reversed_by || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestRow.order_id);
      if (voidOrderError) throw voidOrderError;

      // Defensive reverse-increment guard. ensureEditableOrder currently blocks
      // voiding a paid bill, so amount_paid is almost always 0 here. This guard
      // future-proofs the system: if that restriction is ever relaxed or bypassed,
      // the shift totals will still reflect reality rather than counting
      // voided revenue forever.
      if (numberValue(order.amount_paid) > 0) {
        const { error: reverseError } = await supabase.rpc('reverse_cashier_shift_for_order', {
          p_order_id: requestRow.order_id
        });
        if (reverseError) {
          logger.warn('reviewPosVoidRequest: failed to reverse shift totals for voided order', {
            orderId: requestRow.order_id,
            amountPaid: order.amount_paid,
            error: reverseError.message
          });
        }
      }

      await notificationService.notifyRole(
        'auditor',
        'POS void approved',
        `${order.order_number || 'A POS bill'} was voided and moved out of unpaid captain orders.`,
        {
          type: 'warning',
          category: 'pos_void_request',
          priority: 'high',
          branchId: requestRow.branch_id,
          metadata: {
            request_id: requestId,
            order_id: requestRow.order_id,
            shift_id: requestRow.shift_id,
            kitchen_status: 'voided',
            void_reason: requestRow.reason
          }
        }
      );
      await notificationService.notifyRole(
        'branch_manager',
        'POS void approved',
        `${order.order_number || 'A POS bill'} was voided and moved out of unpaid captain orders.`,
        {
          type: 'warning',
          category: 'pos_void_request',
          priority: 'high',
          branchId: requestRow.branch_id,
          metadata: {
            request_id: requestId,
            order_id: requestRow.order_id,
            shift_id: requestRow.shift_id,
            kitchen_status: 'voided',
            void_reason: requestRow.reason
          }
        }
      );
      if (requestRow.requested_by) {
        await notificationService.notifyUser(
          requestRow.requested_by,
          'Void request APPROVED ✓',
          `Your void request for bill ${order.order_number || requestRow.order_id} was approved. The bill has been cancelled.`,
          {
            type: 'success',
            category: 'pos_void_request',
            priority: 'medium',
            metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id }
          }
        );
      }
    } else {
      await supabase
        .from('pos_shift_orders')
        .update({
          void_request_status: 'rejected',
          kitchen_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestRow.order_id);
      await notificationService.notifyRole(
        'auditor',
        'POS void rejected',
        `${order.order_number || 'A POS bill'} void request was rejected and returned to active POS orders.`,
        {
          type: 'info',
          category: 'pos_void_request',
          priority: 'medium',
          branchId: requestRow.branch_id,
          metadata: {
            request_id: requestId,
            order_id: requestRow.order_id,
            shift_id: requestRow.shift_id,
            kitchen_status: 'pending',
            rejection_reason: rejectionReason
          }
        }
      );
      await notificationService.notifyRole(
        'branch_manager',
        'POS void rejected',
        `${order.order_number || 'A POS bill'} void request was rejected and returned to active POS orders.`,
        {
          type: 'info',
          category: 'pos_void_request',
          priority: 'medium',
          branchId: requestRow.branch_id,
          metadata: {
            request_id: requestId,
            order_id: requestRow.order_id,
            shift_id: requestRow.shift_id,
            kitchen_status: 'pending',
            rejection_reason: rejectionReason
          }
        }
      );
      if (requestRow.requested_by) {
        await notificationService.notifyUser(
          requestRow.requested_by,
          'Void request REJECTED',
          `Your void request for bill ${order.order_number || requestRow.order_id} was rejected${rejectionReason ? `: ${rejectionReason}` : ''}. The bill is back in the active queue.`,
          {
            type: 'warning',
            category: 'pos_void_request',
            priority: 'medium',
            metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id, rejection_reason: rejectionReason }
          }
        );
      }
    }

    res.json({ success: true, data: { id: requestId, status: approved ? 'approved' : 'rejected' } });
  } catch (error) {
    next(error);
  }
};

// Item-level void system. Sits alongside the whole-bill void flow above
// (pos_void_requests / requestVoidShiftOrder / reviewPosVoidRequest) without
// replacing it — a waiter can still void an entire bill via that flow, or
// void a single line item via this one. Items live as a JSONB array on
// pos_shift_orders.items (no relational order_items table), so a line item
// is addressed by its position in that array (item_index) — the same
// convention splitShiftOrder already uses via item_indexes.
const ITEM_VOID_REASON_CATEGORIES = new Set([
  'wrong_order',
  'duplicate_entry',
  'customer_changed_mind',
  'pricing_error',
  'other'
]);

const userDisplayNamesById = async (userIds: string[]): Promise<Map<string, string>> => {
  if (!userIds.length) return new Map();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
    .in('id', userIds);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const user of data || []) {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    map.set(String(user.id), name || user.email || 'Unknown');
  }
  return map;
};

const activeQtyForItem = (item: Record<string, any>): { quantity: number; voidedQty: number; activeQty: number } => {
  const quantity = numberValue(item.quantity ?? item.qty);
  const voidedQty = numberValue(item.voided_qty);
  return { quantity, voidedQty, activeQty: quantity - voidedQty };
};

export const requestItemVoid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const shiftId = String(req.body.shift_id || '');
    const orderId = String(req.body.order_id || '');
    const itemIndex = Number(req.body.item_index);
    const qtyToVoid = numberValue(req.body.qty_to_void ?? req.body.qty);
    const reason = String(req.body.reason || '').trim();
    const reasonCategory = String(req.body.reason_category || 'other').trim().toLowerCase();
    const note = nullableText(req.body.note);

    if (!shiftId || !orderId) throw new AppError('shift_id and order_id are required', 400);
    if (!Number.isInteger(itemIndex) || itemIndex < 0) throw new AppError('A valid item_index is required', 400);
    if (!(qtyToVoid > 0)) throw new AppError('qty_to_void must be greater than zero', 400);
    if (!reason) throw new AppError('Void reason is required', 400);
    if (!ITEM_VOID_REASON_CATEGORIES.has(reasonCategory)) throw new AppError('Invalid reason_category', 400);

    const shift = await ensureShiftAccess(req, shiftId);
    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);
    ensureEditableOrder(order, 'void an item on');

    const items = Array.isArray(order.items) ? order.items : [];
    const item = items[itemIndex];
    if (!item) throw new AppError('Item not found on this bill', 404);

    const { quantity, activeQty } = activeQtyForItem(item);
    if (activeQty <= 0) throw new AppError('This item is already fully voided', 400);
    if (qtyToVoid > activeQty) throw new AppError('Void quantity exceeds the remaining active quantity for this item', 400);

    const { data: existing, error: existingError } = await supabase
      .from('pos_item_void_requests')
      .select('id')
      .eq('order_id', orderId)
      .eq('item_index', itemIndex)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw new AppError('A pending void request already exists for this item', 409);

    const unitPrice = numberValue(item.unit_price ?? item.price);
    const { data: requestRow, error } = await supabase
      .from('pos_item_void_requests')
      .insert({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        order_id: orderId,
        order_number: order.order_number,
        branch_id: shift.branch_id,
        item_index: itemIndex,
        item_name: String(item.name || ''),
        unit_price: unitPrice,
        qty_before_void: activeQty,
        qty_to_void: qtyToVoid,
        reason,
        reason_category: reasonCategory,
        note,
        requested_by: req.user.id,
        status: 'pending'
      })
      .select('*')
      .single();
    if (error || !requestRow) throw error || new AppError('Failed to create item void request', 500);

    // Stage 1: notify only the cashier who has the open shift for this
    // specific outlet — not all cashiers at the branch.
    // shift.cashier_id is the user who opened this pos_outlet_shift.
    const voidNotifMeta = {
      request_id: requestRow.id,
      order_id: orderId,
      order_number: order.order_number,
      shift_id: shiftId,
      item_name: String(item.name || ''),
      qty_to_void: qtyToVoid
    };
    const shiftCashierId = (shift as any).cashier_id;
    if (shiftCashierId) {
      await notificationService.notifyUser(
        shiftCashierId,
        'Item void request',
        `${String(item.name || 'An item')} on bill ${order.order_number || orderId} — void requested (qty: ${qtyToVoid}). Acknowledge or decline.`,
        { type: 'warning', category: 'pos_item_void_request', priority: 'high', metadata: voidNotifMeta }
      );
    }

    res.status(201).json({ success: true, data: requestRow });
  } catch (error) {
    next(error);
  }
};

export const getItemVoidRequestsForShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    await ensureShiftAccess(req, shiftId);

    const { data, error } = await supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = data || [];
    const userIds = Array.from(new Set(
      rows.flatMap((row: any) => [row.requested_by, row.actioned_by]).filter(Boolean)
    ));
    const namesById = await userDisplayNamesById(userIds);
    const enriched = rows.map((row: any) => ({
      ...row,
      requested_by_name: namesById.get(String(row.requested_by)) || null,
      actioned_by_name: row.actioned_by ? namesById.get(String(row.actioned_by)) || null : null
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

export const getItemVoidHistoryForWaiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) throw new AppError('Forbidden: accountant or manager access required', 403);
    const { waiterId } = req.params;
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    let query = supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('requested_by', waiterId)
      .order('created_at', { ascending: false });

    const branchId = req.query.branch_id ? Number(req.query.branch_id) : branchIdFor(req);
    if (!isGlobalUser(req)) {
      if (branchId === null) {
        res.json({ success: true, data: [] });
        return;
      }
      query = query.eq('branch_id', branchId);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', Number(req.query.branch_id));
    }
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
};

export const getPendingItemVoidsForShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId } = req.params;
    await ensureShiftAccess(req, shiftId);

    const { data, error } = await supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('shift_id', shiftId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json({ success: true, data: data || [], count: (data || []).length });
  } catch (error) {
    next(error);
  }
};

export const approveItemVoidRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) throw new AppError('Forbidden: accountant or manager approval required', 403);
    const { id } = req.params;

    const { data: requestRow, error } = await supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);

    // Stage 2: request must have been cashier-acknowledged first.
    if (requestRow.status !== 'void_acknowledged') {
      const check = requestRow.status === 'pending'
        ? 'Void request has not been acknowledged by the cashier yet'
        : 'Void request already processed';
      throw new AppError(check, 409);
    }

    const { data: updatedOrder, error: rpcError } = await supabase.rpc('void_order_item', {
      p_request_id: id,
      p_actioned_by: req.user.id
    });
    if (rpcError) {
      if (String(rpcError.message || '').includes('already processed')) {
        throw new AppError('Void request already processed', 409);
      }
      throw rpcError;
    }

    const approverName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Manager';
    const approveNotifMeta = { request_id: id, order_id: requestRow.order_id, shift_id: requestRow.shift_id };
    await Promise.allSettled([
      requestRow.requested_by && notificationService.notifyUser(
        requestRow.requested_by,
        'Item void APPROVED ✓',
        `Void APPROVED by ${approverName} — "${requestRow.item_name}" removed from bill ${requestRow.order_number || ''}.`,
        { type: 'success', category: 'pos_item_void_request', priority: 'medium', metadata: approveNotifMeta }
      ),
      requestRow.cashier_id && notificationService.notifyUser(
        requestRow.cashier_id,
        'Item void approved',
        `Void on bill ${requestRow.order_number || ''} was approved by ${approverName} — "${requestRow.item_name}" removed.`,
        { type: 'success', category: 'pos_item_void_request', priority: 'low', metadata: approveNotifMeta }
      ),
    ]);

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
};

export const rejectItemVoidRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) throw new AppError('Forbidden: accountant or manager approval required', 403);
    const { id } = req.params;
    const rejectionReason = String(req.body.rejection_reason || req.body.reason || '').trim();

    const { data: requestRow, error } = await supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);

    if (requestRow.status !== 'void_acknowledged') {
      const check = requestRow.status === 'pending'
        ? 'Void request has not been acknowledged by the cashier yet'
        : 'Void request already processed';
      throw new AppError(check, 409);
    }

    const now = new Date().toISOString();

    // Reinstate the item: clear the void_pending_approval flag set at Stage 1
    // so the item reappears on the bill as fully active.
    const { data: orderData } = await supabase
      .from('pos_shift_orders')
      .select('items, total_amount, balance_amount')
      .eq('id', requestRow.order_id)
      .single();

    if (orderData && Array.isArray(orderData.items)) {
      const items = orderData.items as Array<Record<string, any>>;
      if (items[requestRow.item_index]) {
        const reinstated = { ...items[requestRow.item_index], void_pending_approval: false };
        items[requestRow.item_index] = reinstated;
        await supabase
          .from('pos_shift_orders')
          .update({ items, updated_at: now })
          .eq('id', requestRow.order_id);
      }
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from('pos_item_void_requests')
      .update({
        status: 'rejected',
        actioned_by: req.user.id,
        actioned_at: now,
        manager_id: req.user.id,
        manager_reviewed_at: now,
        rejection_reason: rejectionReason || null,
        updated_at: now
      })
      .eq('id', id)
      .eq('status', 'void_acknowledged')
      .select('*')
      .single();
    if (updateError || !updatedRow) {
      throw updateError || new AppError('Void request already processed', 409);
    }

    const rejectorName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Manager';
    const rejectMeta = { request_id: id, order_id: requestRow.order_id, shift_id: requestRow.shift_id, rejection_reason: rejectionReason };
    await Promise.allSettled([
      requestRow.requested_by && notificationService.notifyUser(
        requestRow.requested_by,
        'Item void REJECTED',
        `Void REJECTED by ${rejectorName} — "${requestRow.item_name}" reinstated on bill ${requestRow.order_number || ''}. Item is back on the bill.`,
        { type: 'warning', category: 'pos_item_void_request', priority: 'medium', metadata: rejectMeta }
      ),
      requestRow.cashier_id && notificationService.notifyUser(
        requestRow.cashier_id,
        'Item void rejected — bill reinstated',
        `Void on bill ${requestRow.order_number || ''} was REJECTED by ${rejectorName} — "${requestRow.item_name}" is back. Bill returned to unpaid queue.`,
        { type: 'warning', category: 'pos_item_void_request', priority: 'high', metadata: rejectMeta }
      ),
    ]);

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    next(error);
  }
};

// ── Stage 1: Cashier acknowledge/decline ───────────────────────────────────

export const cashierAcknowledgeItemVoid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isCashierStationRole(roleFor(req)) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: cashier acknowledgment required', 403);
    }
    const { id } = req.params;

    const { data: requestRow, error } = await supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);
    if (requestRow.status !== 'pending') throw new AppError('Void request already actioned', 409);

    const now = new Date().toISOString();

    // Mark item as void_pending_approval in the JSONB array — this hides
    // it from the bill display without changing financial totals yet.
    const { data: orderData, error: orderErr } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('id', requestRow.order_id)
      .single();
    if (orderErr || !orderData) throw new AppError('Order not found', 404);

    const items = Array.isArray(orderData.items) ? [...orderData.items] as Array<Record<string, any>> : [];
    if (!items[requestRow.item_index]) throw new AppError('Item no longer exists on bill', 404);
    items[requestRow.item_index] = { ...items[requestRow.item_index], void_pending_approval: true };

    const { data: updatedOrder, error: orderUpdateErr } = await supabase
      .from('pos_shift_orders')
      .update({ items, updated_at: now })
      .eq('id', requestRow.order_id)
      .select('*')
      .single();
    if (orderUpdateErr) throw orderUpdateErr;

    const { data: updatedReq, error: reqUpdateErr } = await supabase
      .from('pos_item_void_requests')
      .update({
        status: 'void_acknowledged',
        cashier_id: req.user.id,
        cashier_acknowledged_at: now,
        cashier_action: 'acknowledged',
        updated_at: now
      })
      .eq('id', id)
      .select('*')
      .single();
    if (reqUpdateErr) throw reqUpdateErr;

    const cashierName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Cashier';
    const ackMeta = { request_id: id, order_id: requestRow.order_id, shift_id: requestRow.shift_id };
    await Promise.allSettled([
      requestRow.requested_by && notificationService.notifyUser(
        requestRow.requested_by,
        'Void acknowledged — awaiting manager',
        `Cashier ${cashierName} acknowledged the void for "${requestRow.item_name}" on bill ${requestRow.order_number || ''}. Awaiting manager approval.`,
        { type: 'info', category: 'pos_item_void_request', priority: 'medium', metadata: ackMeta }
      ),
      notificationService.notifyRole(
        'branch_accountant',
        'Item void requires manager approval',
        `"${requestRow.item_name}" on bill ${requestRow.order_number || ''} — void acknowledged by cashier. Please approve or reject.`,
        { type: 'warning', category: 'pos_item_void_request', priority: 'high', branchId: requestRow.branch_id, metadata: ackMeta }
      ),
      notificationService.notifyRole(
        'branch_manager',
        'Item void requires approval',
        `"${requestRow.item_name}" on bill ${requestRow.order_number || ''} — cashier acknowledged void. Awaiting your decision.`,
        { type: 'warning', category: 'pos_item_void_request', priority: 'high', branchId: requestRow.branch_id, metadata: ackMeta }
      ),
    ]);

    // Return both the updated request and the updated order so Flutter can
    // immediately print the void receipt and the revised customer bill.
    res.json({ success: true, data: { request: updatedReq, order: updatedOrder } });
  } catch (error) {
    next(error);
  }
};

export const cashierDeclineItemVoid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isCashierStationRole(roleFor(req)) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: cashier action required', 403);
    }
    const { id } = req.params;

    const { data: requestRow, error } = await supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);
    if (requestRow.status !== 'pending') throw new AppError('Void request already actioned', 409);

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('pos_item_void_requests')
      .update({
        status: 'void_cashier_declined',
        cashier_id: req.user.id,
        cashier_acknowledged_at: now,
        cashier_action: 'declined',
        updated_at: now
      })
      .eq('id', id);
    if (updateErr) throw updateErr;

    const cashierName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Cashier';
    if (requestRow.requested_by) {
      await notificationService.notifyUser(
        requestRow.requested_by,
        'Void request declined by cashier',
        `Cashier ${cashierName} declined the void for "${requestRow.item_name}" on bill ${requestRow.order_number || ''} — item stays on the bill.`,
        { type: 'error', category: 'pos_item_void_request', priority: 'medium',
          metadata: { request_id: id, order_id: requestRow.order_id } }
      );
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ── Cashier Stage 1 queue ──────────────────────────────────────────────────

export const getPendingVoidsCashier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const branchId = branchIdFor(req);

    // Find shifts the caller has open (they are the cashier_id on those shifts).
    const { data: myShifts } = await supabase
      .from('pos_outlet_shifts')
      .select('id')
      .eq('cashier_id', req.user.id)
      .eq('status', 'open');

    const myShiftIds = (myShifts || []).map((s: any) => s.id);
    if (!myShiftIds.length) { res.json({ success: true, data: [] }); return; }

    const { data, error } = await supabase
      .from('pos_item_void_requests')
      .select('*')
      .in('shift_id', myShiftIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const rows = data || [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.requested_by).filter(Boolean)));
    const namesById = await userDisplayNamesById(userIds as string[]);
    const enriched = rows.map((r: any) => ({
      ...r,
      requested_by_name: namesById.get(String(r.requested_by)) || null
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

// ── Manager Stage 2 queue and void history ─────────────────────────────────

export const getPendingVoidsManager = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) throw new AppError('Forbidden', 403);
    const branchId = branchIdFor(req);

    let query = supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('status', 'void_acknowledged')
      .order('cashier_acknowledged_at', { ascending: true });

    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const userIds = Array.from(new Set(
      rows.flatMap((r: any) => [r.requested_by, r.cashier_id]).filter(Boolean)
    ));
    const namesById = await userDisplayNamesById(userIds as string[]);
    const enriched = rows.map((r: any) => ({
      ...r,
      requested_by_name: namesById.get(String(r.requested_by)) || null,
      cashier_name: r.cashier_id ? namesById.get(String(r.cashier_id)) || null : null
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

export const getVoidHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) throw new AppError('Forbidden', 403);

    const branchId = req.query.branch_id ? Number(req.query.branch_id) : branchIdFor(req);
    const status = nullableText(String(req.query.status || ''));
    const from = nullableText(String(req.query.from || ''));
    const to = nullableText(String(req.query.to || ''));
    const requestedBy = nullableText(String(req.query.requested_by || ''));
    const cashierId = nullableText(String(req.query.cashier_id || ''));

    let query = supabase
      .from('pos_item_void_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!isGlobalUser(req) && branchId) query = query.eq('branch_id', branchId);
    else if (req.query.branch_id) query = query.eq('branch_id', Number(req.query.branch_id));
    if (status) query = query.eq('status', status);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (requestedBy) query = query.eq('requested_by', requestedBy);
    if (cashierId) query = query.eq('cashier_id', cashierId);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const userIds = Array.from(new Set(
      rows.flatMap((r: any) => [r.requested_by, r.cashier_id, r.manager_id, r.actioned_by]).filter(Boolean)
    ));
    const namesById = await userDisplayNamesById(userIds as string[]);
    const enriched = rows.map((r: any) => ({
      ...r,
      requested_by_name: namesById.get(String(r.requested_by)) || null,
      cashier_name: r.cashier_id ? namesById.get(String(r.cashier_id)) || null : null,
      manager_name: r.manager_id ? namesById.get(String(r.manager_id)) || null : null
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

// ── Post-payment item exchange ──────────────────────────────────────────────
// Distinct from both void flows above: the original pos_shift_orders row is
// CLOSED and PAID, and is never mutated by this flow — it stays the
// historical record of what was actually collected. An exchange creates a
// new, linked pos_shift_orders row (is_exchange/exchange_parent_order_id/
// exchange_request_id, same linking convention as is_split/is_merged)
// carrying the new item(s). Approval is single-stage and cashier-only: per
// product requirement, branch_manager/branch_accountant/accountant/auditor
// get read-only visibility (getExchangeHistory) but cannot approve, reject,
// or issue a refund — unlike the void flows above, REVIEW_ROLES is
// deliberately NOT part of the approval gate here.
const isExchangeApprover = (req: Request): boolean =>
  isCashierStationRole(roleFor(req)) || roleFor(req) === 'super_admin';

export const requestItemExchange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const shiftId = String(req.body.shift_id || '');
    const orderId = String(req.body.order_id || '');
    const oldItems = Array.isArray(req.body.old_items) ? req.body.old_items : [];
    const newItems = Array.isArray(req.body.new_items) ? req.body.new_items : [];
    const reason = nullableText(req.body.reason);

    if (!shiftId || !orderId) throw new AppError('shift_id and order_id are required', 400);
    if (!oldItems.length) throw new AppError('At least one item to return is required', 400);
    if (!newItems.length) throw new AppError('At least one replacement item is required', 400);

    const shift = await ensureShiftAccess(req, shiftId);
    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);

    if (!['paid', 'credit_bill'].includes(String(order.payment_status || ''))) {
      throw new AppError('Only a closed, paid bill can be exchanged', 400);
    }

    const billItems = Array.isArray(order.items) ? order.items : [];
    const normalizedOldItems = oldItems.map((entry: Record<string, any>, index: number) => {
      const itemIndex = Number(entry.item_index);
      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        throw new AppError(`A valid item_index is required for returned item ${index + 1}`, 400);
      }
      const billItem = billItems[itemIndex];
      if (!billItem) throw new AppError(`Returned item ${index + 1} was not found on this bill`, 404);
      const { activeQty } = activeQtyForItem(billItem);
      const quantity = numberValue(entry.quantity ?? entry.qty);
      if (!(quantity > 0)) throw new AppError(`Returned item ${index + 1} must have a quantity greater than zero`, 400);
      if (quantity > activeQty) {
        throw new AppError(`Returned quantity exceeds the active quantity for "${billItem.name}"`, 400);
      }
      const unitPrice = numberValue(billItem.unit_price ?? billItem.price);
      return {
        item_index: itemIndex,
        outlet_item_id: billItem.outlet_item_id ?? null,
        name: String(billItem.name || ''),
        unit_price: unitPrice,
        quantity
      };
    });

    const normalizedNewItems = await normalizeOrderItems(shift.outlet_id, newItems);

    const oldTotal = normalizedOldItems.reduce((sum: number, item: any) => sum + item.unit_price * item.quantity, 0);
    const newTotal = normalizedNewItems.reduce((sum: number, item: any) => sum + item.line_total, 0);
    const priceDifference = Math.round((newTotal - oldTotal) * 100) / 100;
    const direction = priceDifference > 0.004 ? 'top_up' : priceDifference < -0.004 ? 'refund' : 'even';

    const { data: existing, error: existingError } = await supabase
      .from('pos_item_exchange_requests')
      .select('id')
      .eq('order_id', orderId)
      .in('status', ['pending', 'approved'])
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw new AppError('This bill has already been exchanged or has an exchange request awaiting approval', 409);

    const { data: requestRow, error } = await supabase
      .from('pos_item_exchange_requests')
      .insert({
        shift_id: shiftId,
        outlet_id: shift.outlet_id,
        branch_id: shift.branch_id,
        order_id: orderId,
        order_number: order.order_number,
        old_items: normalizedOldItems,
        new_items: normalizedNewItems,
        old_total: oldTotal,
        new_total: newTotal,
        price_difference: priceDifference,
        direction,
        reason,
        requested_by: req.user.id,
        status: 'pending'
      })
      .select('*')
      .single();
    if (error || !requestRow) throw error || new AppError('Failed to create exchange request', 500);

    const shiftCashierId = (shift as any).cashier_id;
    if (shiftCashierId) {
      const directionLabel = direction === 'top_up'
        ? `top-up KES ${priceDifference.toFixed(2)}`
        : direction === 'refund'
          ? `refund KES ${Math.abs(priceDifference).toFixed(2)}`
          : 'even exchange';
      await notificationService.notifyUser(
        shiftCashierId,
        'Item exchange request',
        `Bill ${order.order_number || orderId} — exchange requested (${directionLabel}). Approve or reject.`,
        {
          type: 'warning',
          category: 'pos_item_exchange_request',
          priority: 'high',
          metadata: { request_id: requestRow.id, order_id: orderId, shift_id: shiftId, direction, price_difference: priceDifference }
        }
      );
    }

    res.status(201).json({ success: true, data: requestRow });
  } catch (error) {
    next(error);
  }
};

export const getPendingExchangesCashier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);

    const { data: myShifts } = await supabase
      .from('pos_outlet_shifts')
      .select('id')
      .eq('cashier_id', req.user.id)
      .eq('status', 'open');

    const myShiftIds = (myShifts || []).map((s: any) => s.id);
    if (!myShiftIds.length) { res.json({ success: true, data: [] }); return; }

    const { data, error } = await supabase
      .from('pos_item_exchange_requests')
      .select('*')
      .in('shift_id', myShiftIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const rows = data || [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.requested_by).filter(Boolean)));
    const namesById = await userDisplayNamesById(userIds as string[]);
    const enriched = rows.map((r: any) => ({
      ...r,
      requested_by_name: namesById.get(String(r.requested_by)) || null
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

export const approveItemExchange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isExchangeApprover(req)) throw new AppError('Forbidden: cashier approval required', 403);
    const { id } = req.params;

    const { data: requestRow, error } = await supabase
      .from('pos_item_exchange_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !requestRow) throw new AppError('Exchange request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);
    if (requestRow.status !== 'pending') throw new AppError('Exchange request already processed', 409);

    const { data: newOrder, error: rpcError } = await supabase.rpc('approve_item_exchange', {
      p_request_id: id,
      p_actioned_by: req.user.id
    });
    if (rpcError) {
      if (String(rpcError.message || '').includes('already processed')) {
        throw new AppError('Exchange request already processed', 409);
      }
      throw rpcError;
    }

    // Stock: return the old item(s), deduct the new item(s). Mirrors the
    // two-call shape used for whole-bill void reversal (reviewPosVoidRequest)
    // and original sale posting (payShiftOrder).
    await postPosInventorySale({
      branchId: Number(requestRow.branch_id),
      outletId: requestRow.outlet_id,
      shiftId: requestRow.shift_id,
      orderId: requestRow.order_id,
      items: requestRow.old_items,
      actorId: req.user.id,
      reverse: true
    });
    await postPosInventorySale({
      branchId: Number(requestRow.branch_id),
      outletId: requestRow.outlet_id,
      shiftId: requestRow.shift_id,
      orderId: newOrder.id,
      items: requestRow.new_items,
      actorId: req.user.id
    });

    const cashierName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Cashier';
    const approveMeta = { request_id: id, order_id: requestRow.order_id, exchange_order_id: newOrder.id, shift_id: requestRow.shift_id };
    await Promise.allSettled([
      requestRow.requested_by && notificationService.notifyUser(
        requestRow.requested_by,
        'Item exchange APPROVED ✓',
        `Exchange APPROVED by ${cashierName} on bill ${requestRow.order_number || ''}. New ticket ${newOrder.order_number || ''} sent to kitchen.`,
        { type: 'success', category: 'pos_item_exchange_request', priority: 'medium', metadata: approveMeta }
      ),
      notificationService.notifyRole(
        'branch_accountant',
        'Item exchange approved',
        `Exchange approved by ${cashierName} on bill ${requestRow.order_number || ''}.`,
        { type: 'info', category: 'pos_item_exchange_request', priority: 'low', branchId: requestRow.branch_id, metadata: approveMeta }
      )
    ]);

    res.json({
      success: true,
      data: {
        request: { ...requestRow, status: 'approved', cashier_id: req.user.id, actioned_at: new Date().toISOString(), exchange_order_id: newOrder.id },
        order: newOrder
      }
    });
  } catch (error) {
    next(error);
  }
};

export const rejectItemExchange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isExchangeApprover(req)) throw new AppError('Forbidden: cashier approval required', 403);
    const { id } = req.params;
    const rejectionReason = String(req.body.rejection_reason || req.body.reason || '').trim();

    const { data: requestRow, error } = await supabase
      .from('pos_item_exchange_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !requestRow) throw new AppError('Exchange request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);
    if (requestRow.status !== 'pending') throw new AppError('Exchange request already processed', 409);

    const now = new Date().toISOString();
    const { data: updatedRow, error: updateError } = await supabase
      .from('pos_item_exchange_requests')
      .update({
        status: 'rejected',
        cashier_id: req.user.id,
        actioned_at: now,
        rejection_reason: rejectionReason || null,
        updated_at: now
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updateError || !updatedRow) {
      throw updateError || new AppError('Exchange request already processed', 409);
    }

    const cashierName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Cashier';
    if (requestRow.requested_by) {
      await notificationService.notifyUser(
        requestRow.requested_by,
        'Item exchange REJECTED',
        `Exchange on bill ${requestRow.order_number || ''} was REJECTED by ${cashierName}. Original bill remains as closed.`,
        {
          type: 'warning',
          category: 'pos_item_exchange_request',
          priority: 'medium',
          metadata: { request_id: id, order_id: requestRow.order_id, rejection_reason: rejectionReason }
        }
      );
    }

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    next(error);
  }
};

export const issueExchangeRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isExchangeApprover(req)) throw new AppError('Forbidden: cashier action required', 403);
    const { id } = req.params;

    const { data: requestRow, error } = await supabase
      .from('pos_item_exchange_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !requestRow) throw new AppError('Exchange request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);
    if (requestRow.status !== 'approved') throw new AppError('Exchange request must be approved before a refund can be issued', 400);
    if (requestRow.direction !== 'refund') throw new AppError('This exchange does not owe a refund', 400);
    if (requestRow.refund_issued_at) throw new AppError('Refund has already been issued for this exchange', 409);

    const refundAmount = Math.abs(numberValue(requestRow.price_difference));
    const now = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await supabase
      .from('pos_item_exchange_requests')
      .update({
        refund_amount: refundAmount,
        refund_issued_at: now,
        refund_issued_by: req.user.id,
        updated_at: now
      })
      .eq('id', id)
      .is('refund_issued_at', null)
      .select('*')
      .single();
    if (updateError || !updatedRow) {
      throw updateError || new AppError('Refund has already been issued for this exchange', 409);
    }

    const cashierName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Cashier';
    if (requestRow.requested_by) {
      await notificationService.notifyUser(
        requestRow.requested_by,
        'Exchange refund issued',
        `${cashierName} issued a KES ${refundAmount.toFixed(2)} cash refund for the exchange on bill ${requestRow.order_number || ''}.`,
        {
          type: 'success',
          category: 'pos_item_exchange_request',
          priority: 'low',
          metadata: { request_id: id, order_id: requestRow.order_id, refund_amount: refundAmount }
        }
      );
    }

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    next(error);
  }
};

export const getExchangeHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req)) && !isCashierStationRole(roleFor(req))) {
      throw new AppError('Forbidden', 403);
    }

    const branchId = req.query.branch_id ? Number(req.query.branch_id) : branchIdFor(req);
    const status = nullableText(String(req.query.status || ''));
    const direction = nullableText(String(req.query.direction || ''));
    const from = nullableText(String(req.query.from || ''));
    const to = nullableText(String(req.query.to || ''));

    let query = supabase
      .from('pos_item_exchange_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!isGlobalUser(req) && branchId) query = query.eq('branch_id', branchId);
    else if (req.query.branch_id) query = query.eq('branch_id', Number(req.query.branch_id));
    if (status) query = query.eq('status', status);
    if (direction) query = query.eq('direction', direction);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const userIds = Array.from(new Set(
      rows.flatMap((r: any) => [r.requested_by, r.cashier_id, r.refund_issued_by]).filter(Boolean)
    ));
    const namesById = await userDisplayNamesById(userIds as string[]);
    const enriched = rows.map((r: any) => ({
      ...r,
      requested_by_name: namesById.get(String(r.requested_by)) || null,
      cashier_name: r.cashier_id ? namesById.get(String(r.cashier_id)) || null : null,
      refund_issued_by_name: r.refund_issued_by ? namesById.get(String(r.refund_issued_by)) || null : null
    }));

    res.json({ success: true, data: enriched });
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

    const method = normalizePaymentMethod(req.body.payment_method || req.body.method || 'cash');
    if (!method) {
      throw new AppError('Unsupported payment method', 400);
    }

    const { data: order, error: orderError } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('id', orderId)
      .eq('shift_id', shiftId)
      .single();
    if (orderError || !order) throw new AppError('POS order not found', 404);
    ensureOrderOwnerAccess(req, order);
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

    if (isCleared && !order.inventory_posted_at) {
      await assertPosStockAvailable(
        Number(shift.branch_id),
        shift.outlet_id,
        Array.isArray(order.items) ? order.items as Array<Record<string, any>> : []
      );
    }

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

    if (isCleared && !order.inventory_posted_at) {
      await postPosInventorySale({
        branchId: Number(shift.branch_id),
        outletId: shift.outlet_id,
        shiftId,
        orderId,
        items: Array.isArray(order.items) ? order.items as Array<Record<string, any>> : [],
        actorId: req.user.id
      });

      await supabase
        .from('pos_shift_orders')
        .update({
          inventory_posted_at: new Date().toISOString(),
          inventory_posted_by: req.user.id
        })
        .eq('id', orderId);
    }

    // NOTE: customer receipt printing for this endpoint is intentionally not
    // wired here. The real cashier payment flow goes through processCashierPayment
    // (POST /cashier/pay), which prints client-side, with a server-side fallback
    // at POST /cashier/print-receipt-fallback. This payShiftOrder endpoint has no
    // current Flutter caller (outlet_pos_repository.payOrder is unused) — add
    // printing here too if/when it's actually wired up to a payment UI.

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

    // DORMANT: this endpoint (POST /pos/shifts/:shiftId/close) has no Flutter
    // call site today -- shifts are actually closed via cashier.controller.ts's
    // closeShift (PUT /cashier/shifts/:id/close), which carries the real
    // pending-item-void guard scoped by branch_id. Left in place rather than
    // deleted in case this route becomes reachable later.
    //
    // Block close while any item-level void request on this shift is still
    // pending -- approving/rejecting after close would mutate a bill that's
    // already been swept into the shift summary. Escalate to the branch
    // accountant so the backlog gets cleared rather than silently stalling.
    const { data: pendingItemVoids, error: pendingItemVoidsError } = await supabase
      .from('pos_item_void_requests')
      .select('id')
      .eq('shift_id', shiftId)
      .eq('status', 'pending');
    if (pendingItemVoidsError) throw pendingItemVoidsError;
    if (pendingItemVoids && pendingItemVoids.length > 0) {
      await notificationService.notifyRole(
        'branch_accountant',
        'Shift close blocked by pending item voids',
        `${pendingItemVoids.length} item void request(s) on this shift still need approval or rejection before it can close.`,
        {
          type: 'warning',
          category: 'pos_item_void_request',
          priority: 'high',
          branchId: shift.branch_id,
          metadata: { shift_id: shiftId, pending_request_ids: pendingItemVoids.map((row: Record<string, any>) => row.id) }
        }
      );
      throw new AppError(`Cannot close shift: ${pendingItemVoids.length} pending item void request(s) must be approved or rejected first.`, 400);
    }

    // Block close until every order on this station is settled (paid or
    // recorded as a credit bill).
    const { data: openOrders } = await supabase
      .from('pos_shift_orders')
      .select('id')
      .eq('shift_id', shiftId)
      .in('payment_status', ['unpaid', 'partial']);
    if (openOrders && openOrders.length > 0) {
      throw new AppError(`Cannot close shift: ${openOrders.length} unsettled bill(s) on this station. Settle every order or record it as a credit bill before closing.`, 400);
    }

    const requestedClosingCash = req.body.closing_cash_counted ?? req.body.closingCashCounted;
    const closingCashInput = requestedClosingCash === null || requestedClosingCash === undefined || requestedClosingCash === ''
      ? null
      : numberValue(requestedClosingCash);
    const cashVarianceReason = String(req.body.cash_variance_reason || req.body.variance_reason || '').trim();

    const automation = await runShiftCloseAutomation(shiftId, {
      actorId: req.user.id,
      closingCashCounted: closingCashInput,
      cashVarianceReason
    });

    const { data: stockCounts, error: stockError } = await supabase
      .from('pos_shift_stock_counts')
      .select('*')
      .eq('shift_id', shiftId);
    if (stockError) throw stockError;

    const trackedStockCounts = (stockCounts || []).filter((row: Record<string, any>) => row.track_stock !== false);

    for (const row of trackedStockCounts as Array<Record<string, any>>) {
      await supabase
        .from('pos_outlet_items')
        .update({
          current_stock: numberValue(row.physical_count ?? row.system_closing_stock),
          updated_at: new Date().toISOString()
        })
        .eq('id', row.outlet_item_id)
        .eq('outlet_id', shift.outlet_id);
    }

    await closeOutletVariance(shiftId, req.user.id);

    const summary = await calculateShiftSummary(shiftId);
    const expectedCash = numberValue(summary.expected_cash);
    const closingCashCounted = closingCashInput === null ? expectedCash : closingCashInput;
    const cashVariance = closingCashCounted - expectedCash;
    if (!Number.isFinite(closingCashCounted) || closingCashCounted < 0) {
      throw new AppError('Closing cash count must be a valid non-negative number', 400);
    }

    const finalSummary = {
      ...summary,
      automation,
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
