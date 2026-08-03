import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase';
import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import notificationService from '../services/notification.service';
import { ensureShiftAutomationOpened, runShiftCloseAutomation } from '../services/cashier-automation.service';
import {
  assertPosStockAvailable,
  postPosInventorySale
} from '../services/enterprise-inventory.service';
import { closeOutletVariance } from '../services/inventory-operations.service';
import { recordBarStockMovement } from '../services/unified-bar-stock.service';
import {
  assignedOutletIds,
  canAccessPosOutlet,
  isCashierStationRole,
  loadAssignedPosOutlets,
  shouldRestrictCashierStationAccess,
  stationTypesForCashierRole,
  POS_STATION_CASHIER_ROLE_TYPES
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
  | 'kyogong_sports_bar'
  | 'choma_zone';
type PaymentMethod = 'cash' | 'mpesa' | 'card' | 'credit_bill';

const FOOD_AND_BAR_OUTLET_TYPES = new Set<OutletType>([
  'restaurant',
  'main_bar',
  'executive_bar',
  'kyogong_executive_bar',
  'kyogong_sports_bar',
  'choma_zone'
]);

// Grill/BBQ section — food, not a bar. Routes to the kitchen/KDS exactly like
// the restaurant outlet (item_group 'restaurant'), not the bar item_group,
// so it participates correctly in kitchen consumption, Daily Control variance,
// and KDS ticket printing alongside restaurant orders.
const FOOD_KITCHEN_OUTLET_TYPES = new Set<OutletType>(['restaurant', 'choma_zone']);

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
  if (FOOD_KITCHEN_OUTLET_TYPES.has(type as OutletType)) return 'restaurant';
  if (isFoodOrBarOutlet(type)) return 'bar';
  return 'other';
};

const billTypeForOutlet = (outletType: unknown): 'restaurant' | 'bar' | 'pool' | 'carwash' | 'spa' | 'pos_outlet' | 'other' => {
  const type = String(outletType || '').toLowerCase();
  if (type === 'restaurant' || type === 'choma_zone') return 'restaurant';
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (v: string): boolean => UUID_REGEX.test(v);

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

// Waiter-initiated void chain (whole-bill and per-item): Kitchen (KDS) ack
// -> Cashier ack (financial effect applied) -> Branch Accountant final
// approval. KITCHEN_VOID_ROLES gates the new first stage; the cashier-
// initiated instant-void tool (cashierVoidWholeBill/cashierVoidLineItems)
// is a separate flow and does not use this chain.
const KITCHEN_VOID_ROLES = new Set([
  'kitchen',
  'pos_kitchen',
  'kitchen_operations',
  'choma_zone_kds',
  'head_chef',
  'sous_chef'
]);
const KITCHEN_VOID_NOTIFY_ROLES = ['kitchen', 'pos_kitchen'];

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
      line_total: quantity * unitPrice,
      notes: item.notes ? String(item.notes).trim() || null : null
    };
  });
};

const booleanValue = (value: unknown): boolean =>
  value === true || String(value ?? '').trim().toLowerCase() === 'true';

const activeOrderItemsTotal = (items: Array<Record<string, any>>): number =>
  items.reduce((sum, item) => {
    const hasActiveTotal = item.active_total !== undefined && item.active_total !== null;
    const activeTotal = numberValue(item.active_total);
    if (activeTotal > 0) return sum + activeTotal;

    const quantity = numberValue(item.quantity ?? item.qty);
    const voidedQty = numberValue(item.voided_qty);
    const hasActiveQty = item.active_qty !== undefined && item.active_qty !== null;
    const activeQty = hasActiveQty
      ? numberValue(item.active_qty)
      : Math.max(quantity - voidedQty, 0);
    const unitPrice = numberValue(item.unit_price ?? item.price);

    // Once void metadata exists, never fall back to the original line_total:
    // that stale value is exactly what makes a removed/voided item keep its
    // old price on the customer bill.
    const hasVoidState = hasActiveTotal || hasActiveQty || voidedQty > 0 || booleanValue(item.is_fully_voided);
    if (hasVoidState) {
      if (booleanValue(item.is_fully_voided) || activeQty <= 0 || voidedQty >= quantity) return sum;
      if (unitPrice > 0) return sum + activeQty * unitPrice;
      return sum + Math.max(activeTotal, 0);
    }

    if (activeQty > 0 && unitPrice > 0) return sum + activeQty * unitPrice;
    return sum + numberValue(item.line_total ?? item.total_price ?? item.total);
  }, 0);

const orderItemsTotal = (items: Array<Record<string, any>>): number =>
  activeOrderItemsTotal(items);

const isNullifiedZeroShiftOrder = (order: Record<string, any>): boolean => {
  const totalAmount = numberValue(order.total_amount);
  const amountPaid = numberValue(order.amount_paid);
  const balanceAmount = numberValue(order.balance_amount);
  const status = String(order.status || '').toLowerCase();
  const paymentStatus = String(order.payment_status || '').toLowerCase();
  const items = Array.isArray(order.items) ? order.items : [];

  if (!['open', 'unpaid', 'partial'].includes(status) && !['unpaid', 'partial'].includes(paymentStatus)) {
    return false;
  }

  if (totalAmount !== 0 || amountPaid !== 0 || balanceAmount !== 0) {
    return false;
  }

  if (!items.length) {
    return true;
  }

  return items.every((item: any) => {
    const activeQty = numberValue(item?.active_qty ?? item?.quantity ?? item?.qty);
    const activeTotal = numberValue(item?.active_total ?? item?.line_total);
    return booleanValue(item?.is_fully_voided)
      || (activeQty <= 0 && activeTotal <= 0)
      || numberValue(item?.voided_qty) >= numberValue(item?.quantity ?? item?.qty);
  });
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

  const voidedOrderIds = new Set<string>(
    orderRows
      .filter((o) => {
        const s = String(o.status || '').toLowerCase();
        const p = String(o.payment_status || '').toLowerCase();
        return s === 'voided' || s === 'cancelled' || p === 'voided' || p === 'cancelled';
      })
      .map((o) => String(o.id))
  );

  const activePayments = paymentRows.filter((p) => !voidedOrderIds.has(String(p.order_id)));

  const salesByMethod = activePayments.reduce<Record<PaymentMethod, number>>(
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

  // Cross-outlet settlement (§5): a master bill spanning outlets is collected in
  // full by ONE origin cashier. Revenue stays per outlet (salesByMethod above,
  // keyed by shift), but the physical CASH DRAWER belongs to whoever actually
  // received the money (pos_shift_payments.received_by):
  //  - cash for THIS outlet that a DIFFERENT cashier collected is NOT in this
  //    drawer ('settled through another cashier') — so this cashier is never
  //    shown short for money someone else took;
  //  - cash this cashier collected for OTHER outlets (recorded in those outlets'
  //    shifts) IS in this drawer ('collected for others').
  // For an ordinary shift (received_by == the shift cashier, no cross activity)
  // both adjustments are 0, so expected_cash stays float + cashSales.
  const cashierId = String(shift.cashier_id || '');
  const cashSettledByOtherCashier = cashierId
    ? activePayments
        .filter((p) => normalizePaymentMethod(p.payment_method) === 'cash'
          && p.received_by && String(p.received_by) !== cashierId)
        .reduce((s, p) => s + numberValue(p.amount), 0)
    : 0;
  let cashCollectedForOthers = 0;
  if (cashierId) {
    const { data: crossPayments } = await supabase
      .from('pos_shift_payments')
      .select('amount, payment_method')
      .eq('received_by', cashierId)
      .neq('shift_id', shiftId);
    cashCollectedForOthers = ((crossPayments || []) as Array<Record<string, any>>)
      .filter((p) => normalizePaymentMethod(p.payment_method) === 'cash')
      .reduce((s, p) => s + numberValue(p.amount), 0);
  }
  const ownOutletCash = Math.max(0, cashSales - cashSettledByOtherCashier);
  const expectedCash = openingFloat + ownOutletCash + cashCollectedForOthers;
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
    // Cross-outlet cash reconciliation (§5). expected_cash above is the DRAWER
    // (physical cash this cashier is accountable for). Revenue fields
    // (total_cash_sales etc.) remain this outlet's own revenue.
    own_outlet_cash: ownOutletCash,
    cash_collected_for_others: cashCollectedForOthers,
    cash_settled_by_other_cashier: cashSettledByOtherCashier,
    physical_cash_collected: openingFloat + ownOutletCash + cashCollectedForOthers,
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
  direction: 1 | -1,
  returnedToStock = true
): Promise<void> => {
  // Fetch branch_id once for unified bar stock updates
  const { data: shift } = await supabase
    .from('pos_outlet_shifts')
    .select('branch_id')
    .eq('id', shiftId)
    .maybeSingle();
  const branchId = shift?.branch_id;

  for (const item of items) {
    const outletItemId = String(item.outlet_item_id ?? item.product_id ?? item.id ?? '');
    const quantity = numberValue(item.qty ?? item.quantity);
    if (!outletItemId || quantity <= 0) continue;

    // Atomic RPC: the write itself (sold_quantity/system_closing_stock/
    // variance) is computed server-side from the row's live value, not from
    // a value read earlier in this function — two concurrent sales on the
    // same item can no longer lose a decrement to a stale read.
    const { error: countRpcError } = await supabase.rpc('apply_pos_shift_stock_count_sale', {
      p_shift_id: shiftId,
      p_outlet_item_id: outletItemId,
      p_quantity_delta: direction * quantity
    });
    if (countRpcError) throw countRpcError;

    const { data: outletItem, error: itemError } = await supabase
      .from('pos_outlet_items')
      .select('current_stock, outlet_id, track_stock, stock_pool_item_id, pool_fraction, source_table, source_item_id, sku')
      .eq('id', outletItemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!outletItem) continue;
    if (outletItem.track_stock === false) continue;

    // Pool-aware deduction: items sharing a stock pool (e.g. Half/Quarter
    // Chicken sharing the Full Chicken pool) have no independent stock of
    // their own — deduct the pool-equivalent quantity from the pool item.
    if (outletItem.stock_pool_item_id) {
      if (direction === 1 || (direction === -1 && returnedToStock)) {
        const fraction = numberValue(outletItem.pool_fraction) || 1;
        const { error: poolRpcError } = await supabase.rpc('decrement_pos_outlet_item_stock', {
          p_item_id: outletItem.stock_pool_item_id,
          p_outlet_id: null,
          p_quantity_delta: direction * quantity * fraction
        });
        if (poolRpcError) throw poolRpcError;
      }
      continue;
    }

    const isBarSourced = Boolean(outletItem.source_table === 'bar_drinks' && outletItem.source_item_id);

    // For bar-sourced items, recordBarStockMovement's own pos_outlet_items
    // step below is the sync of record — updating it here too double-decrements
    // the same row for every single sale (confirmed live: bar_stock matched the
    // real sale exactly while pos_outlet_items had drifted to double that).
    if (!isBarSourced) {
      if (direction === 1 || (direction === -1 && returnedToStock)) {
        const { error: itemRpcError } = await supabase.rpc('decrement_pos_outlet_item_stock', {
          p_item_id: outletItemId,
          p_outlet_id: outletItem.outlet_id || outletId,
          p_quantity_delta: direction * quantity
        });
        if (itemRpcError) throw itemRpcError;
      }
    }

    // ── Unified bar stock sync ──────────────────────────────────────
    // Only bar drinks flow into the unified ledger. This call also covers
    // the pos_outlet_items update for this row (see isBarSourced above).
    if (branchId && isBarSourced) {
      try {
        // When returnedToStock=false (broken/wasted item), we now apply a real
        // stock deduction (-quantity) instead of the old qtyDelta=0 which left
        // balances unchanged. The ledger records the movement as 'waste'.
        const qtyDelta = direction === 1 ? -quantity : (returnedToStock ? quantity : -quantity);
        const movType = direction === 1 ? 'sale' : (returnedToStock ? 'sale_reversal' : 'waste');
        const noteText = direction === 1 ? 'POS bar sale' : (returnedToStock ? 'POS bar sale reversal' : 'POS bar void — broken/wasted');

        await recordBarStockMovement({
          branchId,
          outletId: outletItem.outlet_id || outletId,
          drinkId: outletItem.source_item_id,
          sku: outletItem.sku || undefined,
          quantityDelta: qtyDelta,
          movementType: movType,
          referenceId: shiftId,
          shiftId,
          notes: noteText,
          // auditQuantity only used for informational audit logging, not balance change
          auditQuantity: direction === -1 && !returnedToStock ? quantity : undefined
        });
      } catch (syncErr: any) {
        logger.warn(
          `Unified bar stock sync failed for outlet item ${outletItemId} (sku ${outletItem.sku}):`,
          syncErr?.message || syncErr,
          syncErr?.details || ''
        );
        // Fall back to a direct decrement if returning to stock or wasting
        if (direction === 1 || direction === -1) {
          await supabase.rpc('decrement_pos_outlet_item_stock', {
            p_item_id: outletItemId,
            p_outlet_id: outletItem.outlet_id || outletId,
            p_quantity_delta: direction * quantity
          });
        }
      }
    } else if (!isBarSourced && direction === -1 && !returnedToStock && branchId) {
      // Non-bar item voided as broken/wasted: write an ADJUSTMENT_OUT
      // branch_stock_movements row so the movement audit trail is complete.
      // The pos_outlet_items decrement already happened above (line ~781–787).
      supabase.from('branch_stock_movements').insert({
        branch_id: branchId,
        item_sku: outletItem.sku || null,
        movement_type: 'ADJUSTMENT_OUT',
        quantity,
        reference_type: 'pos_void_waste',
        reference_id: shiftId,
        notes: 'POS void — item broken/wasted, not returned to stock',
        performed_by: null,
        created_by: null,
      }).then(({ error: mvErr }) => {
        if (mvErr) logger.warn('branch_stock_movements insert failed (void waste):', mvErr.message);
      });
    }
  }
};

// Links a POS sale to the kitchen raw-material stock it consumed, via
// kitchen_production_recipes (yield ratio: raw_quantity -> produced_quantity).
// Logs the consumption to kitchen_shift_pos_consumption and increments the
// matching kitchen_shift_items.sold_quantity for the branch's currently open
// kitchen shift — the same field recordProduction() increments, so
// closeKitchenShift()'s existing variance formula (opening + additions -
// sold - spoilage) already accounts for POS-driven consumption without any
// changes to that formula. Best-effort: items with no recipe, or branches
// with no open kitchen shift, are silently skipped (not every POS item is
// kitchen-produced).
const recordKitchenConsumption = async (
  orderItems: Array<Record<string, any>>,
  branchId: number,
  posShiftId: string,
  orderId: string
): Promise<void> => {
  if (!branchId || !orderItems.length) return;

  const { data: shift } = await supabase
    .from('kitchen_shifts')
    .select('id')
    .eq('branch_id', branchId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!shift) return;

  const openShiftId = String(shift.id);
  await recordConsumptionForOrder(orderItems, branchId, posShiftId, orderId, openShiftId);
};

// Core per-order consumption recorder, given an explicit kitchen shift id.
// Reused by recordKitchenConsumption (live POS completion) and the shift-open
// backfill (recovers sales made before the kitchen shift opened). Every sold
// outlet item yields at least one kitchen_shift_pos_consumption row: recipe-
// and inventory-linked items are matched; anything else is recorded with
// match_status = 'unmatched' so no sale is ever lost from food control.
export const recordConsumptionForOrder = async (
  orderItems: Array<Record<string, any>>,
  branchId: number,
  posShiftId: string,
  orderId: string,
  shiftId: string
): Promise<void> => {
  const insertUnmatchedConsumption = async (oi: any, portions: number, idx: number) => {
    if (portions <= 0) return;
    try {
      await supabase.from('kitchen_shift_pos_consumption').insert({
        shift_id: shiftId,
        branch_id: branchId,
        pos_shift_id: posShiftId,
        pos_order_id: orderId,
        pos_outlet_item_id: oi?.id ?? null,
        item_index: idx,
        produced_item_sku: oi?.sku ?? null,
        produced_item_name: oi?.name ?? 'Unmapped POS item',
        portions_sold: portions,
        raw_item_sku: oi?.sku ?? null,
        raw_item_name: oi?.name ?? 'Unmapped POS item',
        raw_quantity_consumed: portions,
        raw_unit: 'unit',
        cost_price: 0,
        match_status: 'unmatched',
      });
    } catch (err) {
      // Never let an unmatched-row insert abort the rest of the order (e.g. if
      // the match_status migration hasn't run yet). Best-effort only.
      logger.warn('recordConsumptionForOrder: unmatched consumption insert failed', err as any);
    }
  };

  for (const [itemIndex, item] of orderItems.entries()) {
    const outletItemId = item.outlet_item_id;
    const portionsSold = numberValue(item.quantity);
    if (!outletItemId || portionsSold <= 0) continue;

    const { data: outletItem, error: outletItemError } = await supabase
      .from('pos_outlet_items')
      .select('id, name, sku, stock_pool_item_id, pool_fraction, source_table, source_item_id')
      .eq('id', outletItemId)
      .maybeSingle();
    if (outletItemError) throw outletItemError;
    if (!outletItem) {
      await insertUnmatchedConsumption({ id: outletItemId }, portionsSold, itemIndex);
      continue;
    }

    const { data: recipe } = await supabase
      .from('kitchen_production_recipes')
      .select('*')
      .eq('pos_outlet_item_id', outletItemId)
      .eq('is_active', true)
      .maybeSingle();
    if (recipe && numberValue(recipe.produced_quantity) > 0) {
      const producedQty = numberValue(recipe.produced_quantity);

      // Resolve ingredient list — single-input recipes store the SKU directly on the
      // recipe row; multi-input recipes store 'MULTI' and list ingredients in
      // kitchen_production_recipe_inputs. Both cases produce one consumption row per
      // ingredient so the shift variance and void/reversal logic work uniformly.
      let inputs: Array<{ raw_item_sku: string; raw_item_name: string; quantity: number; unit: string }>;
      if (recipe.raw_item_sku && recipe.raw_item_sku !== 'MULTI') {
        inputs = [{
          raw_item_sku: recipe.raw_item_sku,
          raw_item_name: recipe.raw_item_name,
          quantity: numberValue(recipe.raw_quantity),
          unit: recipe.raw_unit,
        }];
      } else {
        const { data: recipeInputs } = await supabase
          .from('kitchen_production_recipe_inputs')
          .select('raw_item_sku, raw_item_name, quantity, unit')
          .eq('recipe_id', recipe.id);
        inputs = (recipeInputs || []).filter(
          (i: any) => i.raw_item_sku && numberValue(i.quantity) > 0
        );
      }

      for (const input of inputs) {
        const rawQtyConsumed = (numberValue(input.quantity) / producedQty) * portionsSold;
        if (rawQtyConsumed <= 0) continue;

        await supabase.from('kitchen_shift_pos_consumption').insert({
          shift_id: shiftId,
          branch_id: branchId,
          pos_shift_id: posShiftId,
          pos_order_id: orderId,
          pos_outlet_item_id: outletItemId,
          item_index: itemIndex,
          produced_item_sku: recipe.produced_item_sku,
          produced_item_name: recipe.produced_item_name,
          portions_sold: portionsSold,
          raw_item_sku: input.raw_item_sku,
          raw_item_name: input.raw_item_name,
          raw_quantity_consumed: rawQtyConsumed,
          raw_unit: input.unit,
          cost_price: numberValue(recipe.cost_per_output),
        });

        const { data: shiftItem } = await supabase
          .from('kitchen_shift_items')
          .select('id, sold_quantity')
          .eq('shift_id', shiftId)
          .eq('item_sku', input.raw_item_sku)
          .maybeSingle();
        if (shiftItem) {
          await supabase
            .from('kitchen_shift_items')
            .update({ sold_quantity: numberValue(shiftItem.sold_quantity) + rawQtyConsumed, updated_at: new Date().toISOString() })
            .eq('id', shiftItem.id);
        }
      }

      continue;
    }

    let sourceTable = outletItem.source_table;
    let sourceItemId = outletItem.source_item_id;
    let producedItemSku = outletItem.sku;
    let producedItemName = outletItem.name;
    let quantityMultiplier = 1;
    if (outletItem.stock_pool_item_id) {
      quantityMultiplier = numberValue(outletItem.pool_fraction) || 1;
      const { data: poolOutletItem, error: poolOutletItemError } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, source_table, source_item_id')
        .eq('id', outletItem.stock_pool_item_id)
        .maybeSingle();
      if (poolOutletItemError) throw poolOutletItemError;
      if (!poolOutletItem) {
        await insertUnmatchedConsumption(outletItem, portionsSold, itemIndex);
        continue;
      }
      sourceTable = poolOutletItem.source_table;
      sourceItemId = poolOutletItem.source_item_id;
      producedItemSku = poolOutletItem.sku;
      producedItemName = poolOutletItem.name;
    }

    // Not a recipe- or inventory-linked item: still record the sale so it is
    // never lost from food control — flagged 'unmatched' for the accountant to
    // register (recipe / direct / exempt).
    if (sourceTable !== 'restaurant_menu_items' || !sourceItemId) {
      await insertUnmatchedConsumption(outletItem, portionsSold, itemIndex);
      continue;
    }

    const { data: menuItem, error: menuItemError } = await supabase
      .from('restaurant_menu_items')
      .select('id, name, sku, unit, inventory_item_id')
      .eq('id', sourceItemId)
      .maybeSingle();
    if (menuItemError) throw menuItemError;
    if (!menuItem?.inventory_item_id) {
      await insertUnmatchedConsumption(outletItem, portionsSold, itemIndex);
      continue;
    }

    const { data: inventoryItem, error: inventoryItemError } = await supabase
      .from('inventory_items')
      .select('id, sku, item_name, unit, cost_price, default_unit_cost')
      .eq('id', menuItem.inventory_item_id)
      .maybeSingle();
    if (inventoryItemError) throw inventoryItemError;
    if (!inventoryItem?.sku) {
      await insertUnmatchedConsumption(outletItem, portionsSold, itemIndex);
      continue;
    }

    const consumedQuantity = portionsSold * quantityMultiplier;
    if (consumedQuantity <= 0) continue;

    const { data: shiftItem, error: shiftItemError } = await supabase
      .from('kitchen_shift_items')
      .select('id, sold_quantity')
      .eq('shift_id', shiftId)
      .eq('item_sku', inventoryItem.sku)
      .maybeSingle();

    if (shiftItemError) throw shiftItemError;
    if (!shiftItem) {
      // No matching issued-stock row (e.g. a pastry sold before the storekeeper
      // issued it to this shift) — still record the sale below so it is never
      // silently lost from the food-control ledger; it just can't be matched
      // against issued stock for variance until it is issued.
      logger.warn(`No issued kitchen shift stock row found for direct finished-item sale ${inventoryItem.sku} on shift ${shiftId} — recording sale as unmatched`);
    }

    await supabase.from('kitchen_shift_pos_consumption').insert({
      shift_id: shiftId,
      branch_id: branchId,
      pos_shift_id: posShiftId,
      pos_order_id: orderId,
      pos_outlet_item_id: outletItemId,
      item_index: itemIndex,
      produced_item_sku: String(producedItemSku || menuItem.sku || inventoryItem.sku),
      produced_item_name: String(outletItem.name || producedItemName || menuItem.name || inventoryItem.item_name || inventoryItem.sku),
      portions_sold: portionsSold,
      raw_item_sku: inventoryItem.sku,
      raw_item_name: inventoryItem.item_name || menuItem.name || inventoryItem.sku,
      raw_quantity_consumed: consumedQuantity,
      raw_unit: inventoryItem.unit || menuItem.unit,
      cost_price: numberValue(inventoryItem.cost_price ?? inventoryItem.default_unit_cost)
    });

    if (shiftItem) {
      await supabase
        .from('kitchen_shift_items')
        .update({ sold_quantity: numberValue(shiftItem.sold_quantity) + consumedQuantity, updated_at: new Date().toISOString() })
        .eq('id', shiftItem.id);
    }
  }
};

// Reverses kitchen_shift_pos_consumption rows (and the kitchen_shift_items.sold_quantity
// they incremented) that recordKitchenConsumption wrote for a POS order — used by every
// void/exchange path so closeKitchenShift()'s variance formula never permanently double-
// counts a sale that was later cancelled. Best-effort and idempotent: a no-op if the order
// never produced a consumption row (e.g. a drink with no kitchen recipe).
// - Whole-bill void: call with no itemIndex/qtyToReverse — reverses every row for the order.
// - Single line-item void: pass itemIndex (and qtyToReverse for a partial-quantity void) so
//   only that line's share is reversed, leaving the rest of the bill's consumption intact.
const reverseKitchenConsumptionForOrder = async (
  orderId: string,
  options: { itemIndex?: number; qtyToReverse?: number } = {}
): Promise<void> => {
  let query = supabase.from('kitchen_shift_pos_consumption').select('*').eq('pos_order_id', orderId);
  if (options.itemIndex !== undefined) query = query.eq('item_index', options.itemIndex);
  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows || !rows.length) return;

  for (const row of rows) {
    const currentPortions = numberValue(row.portions_sold);
    const currentRawQty = numberValue(row.raw_quantity_consumed);
    if (currentPortions <= 0) continue;

    const qtyToReverse = options.qtyToReverse !== undefined
      ? Math.min(options.qtyToReverse, currentPortions)
      : currentPortions;
    if (qtyToReverse <= 0) continue;

    const rawQtyToReverse = (currentRawQty / currentPortions) * qtyToReverse;

    const { data: shiftItem } = await supabase
      .from('kitchen_shift_items')
      .select('id, sold_quantity')
      .eq('shift_id', row.shift_id)
      .eq('item_sku', row.raw_item_sku)
      .maybeSingle();
    if (shiftItem) {
      await supabase
        .from('kitchen_shift_items')
        .update({
          sold_quantity: Math.max(0, numberValue(shiftItem.sold_quantity) - rawQtyToReverse),
          updated_at: new Date().toISOString()
        })
        .eq('id', shiftItem.id);
    }

    const remainingPortions = currentPortions - qtyToReverse;
    if (remainingPortions <= 0) {
      await supabase.from('kitchen_shift_pos_consumption').delete().eq('id', row.id);
    } else {
      await supabase
        .from('kitchen_shift_pos_consumption')
        .update({ portions_sold: remainingPortions, raw_quantity_consumed: currentRawQty - rawQtyToReverse })
        .eq('id', row.id);
    }
  }
};

// Recovers POS sales that completed BEFORE a kitchen shift was opened — their
// consumption was skipped because recordKitchenConsumption returns early when no
// kitchen shift is open. Called from openKitchenShift. Best-effort and
// idempotent: orders that already produced consumption rows are skipped, so it
// never double-counts. Scoped to the branch's POS outlet shifts.
export const backfillKitchenConsumptionForOpenShift = async (
  branchId: number,
  kitchenShiftId: string,
  sinceIso?: string
): Promise<void> => {
  if (!branchId || !kitchenShiftId) return;

  const since = sinceIso || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: outletShifts } = await supabase
    .from('pos_outlet_shifts')
    .select('id')
    .eq('branch_id', branchId)
    .or(`status.eq.open,opened_at.gte.${since}`)
    .limit(250);
  const shiftIds = (outletShifts || []).map((s: any) => String(s.id)).filter(Boolean);
  if (!shiftIds.length) return;

  const { data: orders } = await supabase
    .from('pos_shift_orders')
    .select('id, shift_id, items, created_at, status, payment_status')
    .in('shift_id', shiftIds)
    .gte('created_at', since)
    .limit(500);
  const candidateOrders = (orders || []).filter((o: any) =>
    Array.isArray(o.items) && o.items.length > 0 &&
    String(o.status || '').toLowerCase() !== 'voided' &&
    String(o.payment_status || '').toLowerCase() !== 'voided'
  );
  if (!candidateOrders.length) return;

  // Skip orders that already have consumption rows (idempotent — no double count).
  const orderIds = candidateOrders.map((o: any) => String(o.id));
  const { data: existingRows } = await supabase
    .from('kitchen_shift_pos_consumption')
    .select('pos_order_id')
    .in('pos_order_id', orderIds);
  const alreadyRecorded = new Set((existingRows || []).map((r: any) => String(r.pos_order_id)));

  for (const order of candidateOrders) {
    if (alreadyRecorded.has(String(order.id))) continue;
    try {
      await recordConsumptionForOrder(
        order.items as any[],
        branchId,
        String(order.shift_id || ''),
        String(order.id),
        kitchenShiftId,
      );
    } catch (err) {
      logger.warn(`backfillKitchenConsumptionForOpenShift: order ${order.id} failed`, err as any);
    }
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
      if (id && isValidUUID(id)) restaurantIds.add(id);
    }
    if (item.source_table === 'bar_drinks') {
      const id = sourceIdForOutletItem(item, '');
      if (id && isValidUUID(id)) barDrinkIds.add(id);
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

  const seededOutletType = (item: Record<string, any>): string =>
    String(item.metadata?.outlet_type || '').trim().toLowerCase();

  const normalizeMainBarPosName = (name: unknown): string => {
    const value = String(name || '').trim();
    if (!value) return value;

    return value
      .replace(/\b1\/4\s*(?:LTR|LITRE|LITER|L)\b/gi, '250ML')
      .replace(/\b1\/2\s*(?:LTR|LITRE|LITER|L)\b/gi, '500ML')
      .replace(/\b3\/4\s*(?:LTR|LITRE|LITER|L)\b/gi, '750ML')
      .replace(/\b1\/4\b/g, '250ML')
      .replace(/\b1\/2\b/g, '350ML')
      .replace(/\b3\/4\b/g, '750ML')
      .replace(/\s+/g, ' ')
      .trim();
  };

  if (outletType === 'restaurant' || outletType === 'choma_zone') {
    let query = supabase
      .from('restaurant_menu_items')
      .select('id, name, price, selling_price, cost_price, category_id, category, metadata, is_available, is_active, branch_id')
      .eq('is_available', true)
      .order('name', { ascending: true });
    
    // Filter strictly by the outlet's branch_id
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) throw error;
    sourceRows = ((data || []) as Array<Record<string, any>>)
      .filter((item) => {
        const routedTo = seededOutletType(item);
        const cat = String(item.category || '').toLowerCase();
        if (outletType === 'choma_zone') {
          return (
            routedTo === 'choma_zone' ||
            cat.includes('choma') ||
            cat.includes('accomp')
          );
        }
        return !routedTo || routedTo === 'restaurant';
      })
      .map((item) => {
        const sku = `R-${item.id}`;
        const existing = existingBySku.get(sku);
        let rawCat = categoryText(item.category) || '';
        if (!rawCat || rawCat.toLowerCase().includes('accomp')) {
          rawCat = 'Accompaniments';
        }
        return {
          outlet_id: outlet.id,
          source_table: 'restaurant_menu_items',
          source_item_id: item.id,
          sku,
          name: item.name,
          category: rawCat || (outletType === 'choma_zone' ? 'Accompaniments' : 'Restaurant'),
          unit: 'each',
          cost_price: item.cost_price || 0,
          selling_price: item.price ?? item.selling_price ?? 0,
          opening_stock: 0,
          current_stock: existing?.current_stock ?? 0,
          track_stock: existing?.track_stock ?? (outletType === 'choma_zone' ? false : true),
          is_active: item.is_active !== false,
          is_available: item.is_available !== false,
          branch_id: outlet.branch_id ?? item.branch_id ?? null
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
    if (branchId) query = query.eq('branch_id', branchId);
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
        track_stock: existing?.track_stock ?? false,
        is_active: item.is_active !== false,
        is_available: item.is_available !== false,
        branch_id: item.branch_id ?? outlet.branch_id ?? null
      };
    });

    if (false && outletType === 'main_bar') {
      let seededMenuQuery = supabase
        .from('restaurant_menu_items')
        .select('id, name, price, selling_price, cost_price, category, metadata, is_available, is_active, branch_id, unit')
        .eq('is_available', true)
        .order('name', { ascending: true });
      if (branchId) seededMenuQuery = seededMenuQuery.eq('branch_id', branchId);
      const { data: seededMenuRows, error: seededMenuError } = await seededMenuQuery;
      if (seededMenuError) throw seededMenuError;

      const seededBarRows = ((seededMenuRows || []) as Array<Record<string, any>>)
        .filter((item) => seededOutletType(item) === 'main_bar')
        .map((item) => {
          const sku = `MOG-BAR-${item.metadata?.source_code || item.id}`;
          const existing = existingBySku.get(sku);
          return {
            outlet_id: outlet.id,
            source_table: 'restaurant_menu_items',
            source_item_id: item.id,
            sku,
            name: normalizeMainBarPosName(item.name),
            category: categoryText(item.category) || 'Main Bar',
            unit: item.unit || 'each',
            cost_price: item.cost_price || 0,
            selling_price: item.price ?? item.selling_price ?? 0,
            opening_stock: 0,
            current_stock: existing?.current_stock ?? 0,
            track_stock: existing?.track_stock ?? false,
            is_active: item.is_active !== false,
            is_available: item.is_available !== false,
            branch_id: item.branch_id ?? outlet.branch_id ?? null
          };
        });

      sourceRows.push(...seededBarRows);
    }
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
    .eq('branch_id', outlet.branch_id)
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
  // NB: pos_outlet_items has NO category_id / category_sort_order / outlet_type
  // columns (category is a plain text column). Selecting them made PostgREST
  // reject the whole query ("column pos_outlet_items.category_id does not
  // exist") and 400 the /pos/bootstrap call. Category id/sort_order are derived
  // downstream by applySourceCategory (from the source menu tables), so they are
  // not needed here.
  let query = supabase
    .from('pos_outlet_items')
    .select('id,outlet_id,source_table,source_item_id,menu_item_id,sku,name,category,unit,cost_price,selling_price,opening_stock,current_stock,track_stock,is_active,is_available,status,branch_id,stock_pool_item_id,pool_fraction')
    .eq('outlet_id', outlet.id)
    .eq('is_active', true);

  if (outlet.branch_id) {
    query = query.or(`branch_id.is.null,branch_id.eq.${outlet.branch_id}`);
  }

  query = query
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  let items = ((data || []) as Array<Record<string, any>>).filter((item) => {
    if (outlet.branch_id && item.branch_id && Number(item.branch_id) !== Number(outlet.branch_id)) {
      return false;
    }
    return true;
  });

  if (items.length > 0 && !refreshFromSource) {
    if (String(outlet.outlet_type || '') === 'choma_zone') {
      const hasAccompaniments = items.some((i) => String(i.category || '').toLowerCase().includes('accomp'));
      if (!hasAccompaniments) {
        const synced = await seedOutletItemsFromExistingMenus(outlet);
        if (synced.length) return synced;
      }
    }
    return items;
  }

  if (refreshFromSource && isFoodOrBarOutlet(outlet.outlet_type)) {
    const synced = await seedOutletItemsFromExistingMenus(outlet);
    if (synced.length) return synced;
  }

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

/**
 * Make a newly-created restaurant_menu_items row immediately SELLABLE at the
 * POS by linking it into the branch's restaurant POS outlet(s) (pos_outlet_items).
 * seedOutletItemsFromExistingMenus only runs on an empty outlet / explicit sync,
 * so without this a menu item added from the accountant module lands in the
 * legacy table but never reaches the till or kitchen. Best-effort + idempotent
 * (upsert on outlet_id,sku), so it never blocks the menu-item create itself.
 */
export const linkMenuItemToRestaurantPosOutlets = async (
  item: Record<string, any>
): Promise<void> => {
  try {
    const itemId = item?.id;
    if (!itemId) return;
    let outletsQuery = supabase
      .from('pos_outlets')
      .select('id, branch_id, outlet_type')
      .eq('outlet_type', 'restaurant');
    if (item.branch_id != null) outletsQuery = outletsQuery.eq('branch_id', item.branch_id);
    const { data: outlets } = await outletsQuery;
    if (!outlets || !outlets.length) return;

    const categoryLabel = categoryText((item as any).category) || 'Restaurant';
    const sellingPrice = Number(item.price ?? item.selling_price ?? 0);
    for (const outlet of outlets as Array<Record<string, any>>) {
      const row = {
        outlet_id: outlet.id,
        source_table: 'restaurant_menu_items',
        source_item_id: itemId,
        sku: `R-${itemId}`,
        name: item.name,
        category: categoryLabel,
        unit: 'each',
        cost_price: Number(item.cost_price || 0),
        selling_price: sellingPrice,
        opening_stock: 0,
        current_stock: 0,
        track_stock: true,
        is_active: item.is_active !== false,
        is_available: item.is_available !== false,
        branch_id: item.branch_id ?? outlet.branch_id ?? null,
      };
      await supabase
        .from('pos_outlet_items')
        .upsert(row, { onConflict: 'outlet_id,sku' });
    }
  } catch (err) {
    logger.warn('linkMenuItemToRestaurantPosOutlets failed:', (err as Error).message);
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

// Remove a single item from an outlet's menu. This deletes only the
// pos_outlet_items row (the outlet's sellable copy) — it never touches the
// source menu (restaurant_menu_items / bar_drinks), so the item simply stops
// being sold at THIS outlet. Same management-role gate as create/update.
export const deleteOutletItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    const { data: existing } = await supabase
      .from('pos_outlet_items')
      .select('id')
      .eq('id', itemId)
      .eq('outlet_id', outletId)
      .maybeSingle();
    if (!existing) throw new AppError('Outlet item not found', 404);

    const { error } = await supabase
      .from('pos_outlet_items')
      .delete()
      .eq('id', itemId)
      .eq('outlet_id', outletId);
    if (error) throw error;

    res.json({ success: true, data: { id: itemId } });
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

    logger.info(`getBarCaptainOrders - Branch ID: ${branchId}, Lookback: ${lookbackSince}`);

    let shiftQuery = supabase
      .from('pos_outlet_shifts')
      .select('id, branch_id, outlet_id, status, opened_at, outlet:pos_outlets(name, outlet_type)')
      .or(`status.eq.open,opened_at.gte.${lookbackSince}`)
      .order('opened_at', { ascending: false })
      .limit(250);

    if (branchId) shiftQuery = shiftQuery.eq('branch_id', branchId);

    const { data: outletShifts, error: shiftError } = await shiftQuery;
    if (shiftError) throw shiftError;

    logger.info(`getBarCaptainOrders - Found ${outletShifts?.length || 0} outlet shifts`);

    // Each bar cashier auto-prints captain tickets only for THEIR OWN bar
    // outlet(s). A main-bar / sports-bar order must never print at the
    // executive-bar station (and vice-versa) — so scope shifts to the outlets
    // this cashier's role/assignment can access. Global/manager roles see all.
    const isGlobal = isGlobalUser(req);
    const cashierRole = roleFor(req);
    const assignedOutlets = await loadAssignedPosOutlets(supabase, req.user?.id);

    const barShiftIds = (outletShifts || [])
      .filter((shift: any) => {
        const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
        const isBarOutlet = BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES.has(String(outlet?.outlet_type || '') as OutletType);
        if (!isBarOutlet) return false;
        if (!isGlobal) {
          const outletObj = {
            id: shift.outlet_id,
            outlet_type: outlet?.outlet_type,
            branch_id: shift.branch_id,
            name: outlet?.name,
          };
          if (!canAccessPosOutlet(cashierRole, outletObj, assignedOutlets, branchId)) {
            return false;
          }
        }
        return true;
      })
      .map((shift: any) => shift.id);
    const shiftsById = new Map((outletShifts || []).map((shift: any) => [shift.id, shift]));

    logger.info(`getBarCaptainOrders - Bar shift IDs: ${barShiftIds.length}`);

    let barOrders: any[] = [];
    if (barShiftIds.length) {
      logger.info(`getBarCaptainOrders - Querying orders for ${barShiftIds.length} shifts`);
      const { data: posOrders, error: posOrdersError } = await supabase
        .from('pos_shift_orders')
        .select('*')
        .in('shift_id', barShiftIds)
        .or('status.eq.open,status.eq.voided,payment_status.eq.voided,void_request_status.in.(pending,approved),kitchen_status.in.(void_requested,cancelled,voided,pending,preparing,ready,recalled)')
        .order('created_at', { ascending: true })
        .limit(500);

      if (posOrdersError) throw posOrdersError;

      logger.info(`getBarCaptainOrders - Found ${posOrders?.length || 0} orders before filtering`);

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
          // Exact time the captain ticket was last printed (updates on each
          // (re)print/recall via markCaptainOrderPrinted). Surfaced so the KDS
          // and cashier can show "last printed at" in Kenyan time for
          // accountability — including recalled orders.
          captain_printed_at: order.captain_printed_at || null,
          original_bill_printed_at: order.original_bill_printed_at || null,
          last_bill_printed_at: order.last_bill_printed_at
            || order.original_bill_printed_at || order.captain_printed_at || null,
          bill_reprint_count: Number(order.bill_reprint_count || 0),
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

    if (barOrders.length) {
      for (const order of barOrders) {
        if (!order.captain_order_already_printed) {
          const orderItems = order.items;
          const latestRecalledAt = orderItems
            .filter((item: any) => item?.is_recalled_item)
            .map((item: any) => new Date(item?.recalled_at || 0).getTime())
            .filter((time: number) => Number.isFinite(time))
            .reduce((max: number, time: number) => Math.max(max, time), 0);

          const latestRecalledAtDate = latestRecalledAt > 0 ? new Date(latestRecalledAt) : null;

          try {
            const queryText = latestRecalledAtDate
              ? `UPDATE pos_shift_orders 
                 SET captain_printed_at = NOW() 
                 WHERE id = $1 
                   AND (captain_printed_at IS NULL OR captain_printed_at < $2)
                 RETURNING id`
              : `UPDATE pos_shift_orders 
                 SET captain_printed_at = NOW() 
                 WHERE id = $1 
                   AND captain_printed_at IS NULL
                 RETURNING id`;

            const queryParams = latestRecalledAtDate
              ? [order.source_id, latestRecalledAtDate.toISOString()]
              : [order.source_id];

            const updateResult = await db.query(queryText, queryParams);

            if (updateResult.rowCount && updateResult.rowCount > 0) {
              logger.info(`getBarCaptainOrders - Won print lock for order ${order.order_number} (${order.source_id})`);
              order.captain_order_already_printed = false;
            } else {
              logger.info(`getBarCaptainOrders - Lost print lock for order ${order.order_number} (${order.source_id})`);
              order.captain_order_already_printed = true;
            }
          } catch (updateError) {
            logger.error(`getBarCaptainOrders - Error securing print lock for order ${order.order_number}:`, updateError);
            order.captain_order_already_printed = true;
          }
        }
      }
    }

    logger.info(`getBarCaptainOrders - Returning ${barOrders.length} orders after filtering`);
    res.json({ success: true, data: barOrders });
  } catch (error) {
    next(error);
  }
};

// Snapshot every active outlet item into pos_shift_stock_counts so the shift
// has an opening-stock sheet. Every path that creates a pos_outlet_shifts row
// must call this — the bridge paths that auto-open a POS shift from an
// approved cashier shift used to skip it, leaving the shift with no stock
// sheet, so nothing was tracked per-shift and the close automation posted
// zero stock movements.
const seedShiftStockCounts = async (shiftId: string, outletId: string): Promise<void> => {
  const { data: existingCounts } = await supabase
    .from('pos_shift_stock_counts')
    .select('id')
    .eq('shift_id', shiftId)
    .limit(1);
  if (existingCounts && existingCounts.length) return;

  const [{ data: items, error: itemsError }, { data: outlet }] = await Promise.all([
    supabase.from('pos_outlet_items').select('*').eq('outlet_id', outletId).eq('is_active', true),
    supabase.from('pos_outlets').select('id, branch_id, outlet_type').eq('id', outletId).maybeSingle()
  ]);
  if (itemsError) throw itemsError;

  const branchId = outlet?.branch_id;
  const barLocation = String(outlet?.outlet_type || '').includes('executive') ? 'executive_bar' : 'main_bar';

  // Fetch recent physical counts from bar_stocktake_records & bar_stock to use as shift opening stock
  const physicalCountsByInvId = new Map<string, number>();
  const physicalCountsByDrinkId = new Map<string, number>();

  if (branchId) {
    const [{ data: stocktakeRows }, { data: barStockRows }] = await Promise.all([
      supabase
        .from('bar_stocktake_records')
        .select('item_id, physical_quantity, recorded_at')
        .eq('branch_id', branchId)
        .eq('bar_location', barLocation)
        .in('status', ['submitted', 'reviewed', 'approved'])
        .order('recorded_at', { ascending: false }),
      supabase
        .from('bar_stock')
        .select('drink_id, current_stock')
        .eq('branch_id', branchId)
    ]);

    for (const r of stocktakeRows || []) {
      if (r.item_id && r.physical_quantity != null && !physicalCountsByInvId.has(String(r.item_id))) {
        physicalCountsByInvId.set(String(r.item_id), Number(r.physical_quantity));
      }
    }

    for (const r of barStockRows || []) {
      if (r.drink_id && r.current_stock != null && !physicalCountsByDrinkId.has(String(r.drink_id))) {
        physicalCountsByDrinkId.set(String(r.drink_id), Number(r.current_stock));
      }
    }
  }

  const stockRows = ((items || []) as Array<Record<string, any>>).map((item) => {
    const sourceItemId = String(item.source_item_id || '').trim();
    let openingStock = item.current_stock ?? item.opening_stock ?? 0;

    if (sourceItemId && physicalCountsByDrinkId.has(sourceItemId)) {
      openingStock = physicalCountsByDrinkId.get(sourceItemId)!;
    } else if (item.inventory_item_id && physicalCountsByInvId.has(String(item.inventory_item_id))) {
      openingStock = physicalCountsByInvId.get(String(item.inventory_item_id))!;
    }

    const numOpening = Number(openingStock) || 0;

    return {
      shift_id: shiftId,
      outlet_id: outletId,
      outlet_item_id: item.id,
      item_name: item.name,
      sku: item.sku,
      unit: item.unit || 'each',
      cost_price: item.cost_price || 0,
      selling_price: item.selling_price || 0,
      opening_stock: numOpening,
      additions: 0,
      sold_quantity: 0,
      system_closing_stock: numOpening,
      track_stock: item.track_stock !== false
    };
  });

  if (stockRows.length) {
    const { error: stockError } = await supabase.from('pos_shift_stock_counts').insert(stockRows);
    if (stockError) throw stockError;
  }
};

/**
 * Bridge driver lookup: the open cashier shift (cashier_shift_logs) whose
 * cashier's role serves this outlet's station type, plus every open cashier
 * shift grouped by cashier so callers can tell whether a POS shift's own
 * cashier is still mid-session. One branch query serves both answers.
 */
const findBridgeCashierShift = async (
  outlet: Record<string, any>
): Promise<{ match: Record<string, any> | null; openByCashier: Map<string, Array<Record<string, any>>> }> => {
  const { data: branchShifts } = await supabase
    .from('cashier_shift_logs')
    .select('id, cashier_id, shift_start')
    .eq('branch_id', outlet.branch_id)
    .eq('status', 'open');
  const rows = (branchShifts || []) as Array<Record<string, any>>;

  const openByCashier = new Map<string, Array<Record<string, any>>>();
  for (const row of rows) {
    const key = String(row.cashier_id || '');
    if (!key) continue;
    const list = openByCashier.get(key) || [];
    list.push(row);
    openByCashier.set(key, list);
  }

  let match: Record<string, any> | null = null;
  const cashierIds = Array.from(openByCashier.keys());
  if (cashierIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, role')
      .in('id', cashierIds);
    const roleById = new Map((users || []).map((u: any) => [u.id, u.role]));
    const outletType = String(outlet.outlet_type || '').toLowerCase();
    match = rows.find((s: any) =>
      stationTypesForCashierRole(
        roleById.get(s.cashier_id),
        outlet.branch_id,
      ).includes(outletType)) || null;
  }

  return { match, openByCashier };
};

const loadOpenShiftForOutlet = async (
  req: Request,
  outlet: Record<string, any>
): Promise<Record<string, any> | null> => {
  let { data, error } = await supabase
    .from('pos_outlet_shifts')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const { match, openByCashier } = await findBridgeCashierShift(outlet);

  // A POS station shift must never outlive the cashier session it was
  // bridged from: waiters' "Recent orders" are scoped to the open POS shift,
  // so a row that survives into the next cashier session keeps showing the
  // previous session's already-cleared bills. If the station's current open
  // cashier shift started AFTER this POS shift opened, and the POS shift's
  // own cashier is no longer mid-session (they have no open cashier shift
  // from before the POS shift opened), the row is a leftover the
  // cashier-close sweep missed — retire it and bridge a fresh one below.
  if (data && match) {
    const posOpenedAt = new Date(data.opened_at).getTime();
    const matchStartedAt = new Date(match.shift_start).getTime();
    const ownerShifts = openByCashier.get(String(data.cashier_id || '')) || [];
    const ownerStillOnDuty = ownerShifts.some(
      (s) => new Date(s.shift_start).getTime() <= posOpenedAt
    );
    if (Number.isFinite(matchStartedAt) && matchStartedAt > posOpenedAt && !ownerStillOnDuty) {
      const now = new Date().toISOString();
      const { data: closedRows, error: closeErr } = await supabase
        .from('pos_outlet_shifts')
        .update({ status: 'closed', closed_at: now, updated_at: now })
        .eq('id', data.id)
        .eq('status', 'open')
        .select('id');
      if (closeErr) throw closeErr;
      logger.info(
        `Rotated stale POS shift ${data.id} on outlet ${outlet.id}: cashier shift ${match.id} started ${match.shift_start} after it opened${closedRows?.length ? '' : ' (already rotated concurrently)'}`
      );
      data = null;
    }
  }

  if (!data && match) {
    // Re-check before inserting — bootstrap polls run concurrently and the
    // rotation above may have raced another request that already re-opened.
    const { data: fresh } = await supabase
      .from('pos_outlet_shifts')
      .select('*')
      .eq('outlet_id', outlet.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fresh) {
      data = fresh;
    } else {
      const { data: created, error: createErr } = await supabase
        .from('pos_outlet_shifts')
        .insert({
          outlet_id: outlet.id,
          branch_id: outlet.branch_id,
          cashier_id: match.cashier_id,
          opening_float: 0,
          status: 'open',
        })
        .select('*')
        .single();
      if (createErr) throw createErr;
      data = created;
      await seedShiftStockCounts(created.id, outlet.id);
    }
  }

  return data && data.summary
    ? { ...data, summary: sanitizeSummary(data.summary, canViewProfit(req)) }
    : data;
};

const loadShiftOrdersForPos = async (
  req: Request,
  shiftId: string
): Promise<Array<Record<string, any>>> => {
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

  const orderIds = (data || []).map((order: any) => order.id);
  const activeExchangeOrderIds = new Set<string>();
  if (orderIds.length) {
    const { data: exchangeRows, error: exchangeError } = await supabase
      .from('pos_item_exchange_requests')
      .select('order_id')
      .in('order_id', orderIds)
      .in('status', ['pending', 'approved']);
    if (exchangeError) {
      logger.warn('Failed to fetch active exchange requests for POS order list', exchangeError.message);
    } else {
      for (const row of (exchangeRows || [])) activeExchangeOrderIds.add(row.order_id);
    }
  }

  return (data || []).map((order: any) => ({
    ...order,
    has_active_exchange_request: activeExchangeOrderIds.has(order.id)
  }));
};

const queryAccessibleOutlets = async (
  req: Request,
  outletType?: unknown,
  branchIdOverride?: unknown
): Promise<Array<Record<string, any>>> => {
  let query = supabase
    .from('pos_outlets')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (outletType) query = query.eq('outlet_type', outletType as OutletType);
  if (!isGlobalUser(req)) {
    const branchId = branchIdFor(req);
    if (branchId === null) return [];
    query = query.eq('branch_id', branchId);
  } else if (branchIdOverride) {
    query = query.eq('branch_id', Number(branchIdOverride));
  }

  const { data, error } = await query;
  if (error) throw error;

  const role = roleFor(req);
  const assignedOutlets = await loadAssignedPosOutlets(supabase, req.user?.id);
  const ids = assignedOutletIds(assignedOutlets);
  let rows = ((data || []) as Array<Record<string, any>>);
  if (shouldRestrictCashierStationAccess(role, ids, branchIdOverride ?? branchIdFor(req))) {
    const roleOutletTypes = stationTypesForCashierRole(
      role,
      branchIdOverride ?? branchIdFor(req),
    );
    rows = rows.filter((outlet) =>
      ids.includes(String(outlet.id)) ||
      roleOutletTypes.includes(String(outlet.outlet_type || '').toLowerCase())
    );
  }
  return removeCrossBranchOutletLeaks(rows);
};

export const getPosBootstrap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const outlets = await queryAccessibleOutlets(
      req,
      req.query.all_outlets === 'true' ? undefined : req.query.outlet_type,
      req.query.branch_id
    );
    const requestedOutletId = String(req.query.outlet_id || req.query.outletId || '').trim();
    const requestedOutletType = String(req.query.selected_outlet_type || req.query.outlet_type || '').trim().toLowerCase();
    const selectedOutlet = outlets.find((outlet) => String(outlet.id) === requestedOutletId) ||
      outlets.find((outlet) => String(outlet.outlet_type || '').toLowerCase() === requestedOutletType) ||
      outlets[0] ||
      null;

    if (!selectedOutlet) {
      res.json({
        success: true,
        data: { outlets, outlet: null, shift: null, items: [], orders: [] }
      });
      return;
    }

    await ensureCashierOutletAccess(req, selectedOutlet);

    const [shift, rawItems] = await Promise.all([
      loadOpenShiftForOutlet(req, selectedOutlet),
      loadActiveOutletItems(selectedOutlet, req.query.sync === 'true')
    ]);
    const items = enrichOutletItems(
      selectedOutlet,
      await hydrateOutletItemCategories(selectedOutlet, applyPoolDerivedStock(rawItems))
    );
    const orders = shift ? await loadShiftOrdersForPos(req, String(shift.id)) : [];

    res.json({
      success: true,
      data: {
        outlets,
        outlet: selectedOutlet,
        shift,
        items,
        orders
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getOutlets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { outlet_type } = req.query;
    const rows = await queryAccessibleOutlets(req, outlet_type, req.query.branch_id);

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

    if (false && includeRelated && isFoodOrBarOutlet(outlet.outlet_type)) {
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
      const sync = req.query.sync === 'true';
      for (const branchOutlet of (outlets || []) as Array<Record<string, any>>) {
        const items = applyPoolDerivedStock(await loadActiveOutletItems(branchOutlet, sync));
        const categorisedItems = await hydrateOutletItemCategories(branchOutlet, items);
        merged.push(...enrichOutletItems(branchOutlet, categorisedItems));
      }

      merged.sort(sortOutletItems);

      res.json({ success: true, data: merged });
      return;
    }

    const sync = req.query.sync === 'true';
    const items = await hydrateOutletItemCategories(
      outlet,
      applyPoolDerivedStock(await loadActiveOutletItems(outlet, sync))
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

    // Bridge (per-station): this station's POS is "open" only when a cashier
    // whose role serves THIS station type (e.g. main_bar_cashier → main_bar)
    // has an open shift (cashier_shift_logs). When they do, open the station's
    // POS shift so waiters can order against it. No matching cashier shift →
    // stays closed (waiters can't order, and can't open a shift themselves).
    // Stale POS shifts left over from a previous cashier session are rotated
    // out inside loadOpenShiftForOutlet.
    const data = await loadOpenShiftForOutlet(req, outlet);
    res.json({ success: true, data });
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
    if (!isCashierStationRole(openerRole, req.user?.branch_id) &&
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

    await seedShiftStockCounts(shift.id, String(outletId));

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
    const masterBillIds = Array.from(
      new Set(
        (data || [])
          .map((order: any) => String(order.master_bill_id || '').trim())
          .filter(Boolean)
      )
    );
    const cashierSettledMasterBillIds = await loadCashierSettledMasterBillIds(masterBillIds);
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
      cashier_clearance_pending: Boolean(
        order.master_bill_id &&
          ['paid', 'partial'].includes(String(order.payment_status || '').toLowerCase()) &&
          !cashierSettledMasterBillIds.has(String(order.master_bill_id))
      ),
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
        // Master bill: when the waiter adds items from another outlet to an
        // existing customer bill, the new outlet order carries the same
        // master_bill_id so it joins that one bill (and shows as 'included').
        // Only set when actually linking, so ordinary order placement never
        // references these columns (safe before the migration lands).
        ...(nullableText(req.body.master_bill_id)
          ? {
              master_bill_id: nullableText(req.body.master_bill_id),
              sub_bill_status: 'included'
            }
          : {}),
        created_by: req.user.id
      })
      .select('*')
      .single();
    if (error || !order) throw error || new AppError('Failed to record POS order', 500);

    // Keep the master bill total in step when this order joined an existing bill.
    if (nullableText(req.body.master_bill_id)) {
      await recomputeMasterBillTotals(String(req.body.master_bill_id)).catch(() => {});
    }

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

    // Kitchen raw-material consumption link — best-effort, never blocks order
    // placement. See recordKitchenConsumption() below.
    recordKitchenConsumption(normalizedItems, Number(shift.branch_id), shiftId, order.id)
      .catch((consumptionError) => logger.warn('recordKitchenConsumption failed', consumptionError as any));

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

export const nullifyZeroShiftOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    await ensureShiftAccess(req, shiftId);
    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);

    if (!isNullifiedZeroShiftOrder(order)) {
      throw new AppError('Only fully-voided zero-value ghost bills can be nullified', 400);
    }

    const nullifyReason = String(req.body.reason || 'Nullified ghost bill with zero value').trim();
    const { data, error } = await supabase
      .from('pos_shift_orders')
      .update({
        status: 'voided',
        payment_status: 'voided',
        void_reason: nullifyReason,
        voided_at: new Date().toISOString(),
        voided_by: req.user?.id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('shift_id', shiftId)
      .select('*')
      .single();

    if (error || !data) throw error || new AppError('Failed to nullify zero-value bill', 500);
    res.json({ success: true, data });
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

export const markOriginalBillPrinted = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { shiftId, orderId } = req.params;
    await ensureShiftAccess(req, shiftId);
    const order = await loadShiftOrder(shiftId, orderId);
    ensureOrderOwnerAccess(req, order);

    const { data, error } = await supabase
      .from('pos_shift_orders')
      .update({
        original_bill_printed_at: new Date().toISOString(),
        last_bill_printed_at: new Date().toISOString(),
        bill_reprint_count: 0
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error || !data) throw error || new AppError('Failed to mark bill printed', 500);
    res.json({ success: true, data });
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
      .update({
        bill_reprint_count: currentCount + 1,
        last_bill_printed_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('shift_id', shiftId)
      .eq('bill_reprint_count', currentCount) // optimistic lock against a concurrent reprint racing this one
      .select('bill_reprint_count, last_bill_printed_at')
      .single();
    if (error || !data) {
      throw new AppError('Reprint limit reached. Only one duplicate bill is allowed.', 409);
    }

    res.json({
      success: true,
      data: {
        bill_reprint_count: data.bill_reprint_count,
        last_bill_printed_at: data.last_bill_printed_at
      }
    });
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
        original_bill_printed_at: null,
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

    // Full-order voids always return items to stock — items that are physically
    // broken/damaged should be handled via the spoilage flow, not a full-order void.
    const returnedToStock = true;

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
        status: 'pending',
        returned_to_stock: returnedToStock
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

    // New chain: kitchen (KDS) reviews first, then cashier (financial effect
    // applied so shift totals are correct), then branch accountant gives the
    // final compliance sign-off. Only kitchen is actionable at this point.
    await Promise.allSettled(
      KITCHEN_VOID_NOTIFY_ROLES.map((role) =>
        notificationService.notifyRole(
          role,
          'Bill void request — KDS review required',
          `${order.order_number || 'A POS bill'} needs void acknowledgment in KDS.`,
          {
            type: 'warning',
            category: 'pos_void_request',
            priority: 'high',
            branchId: shift.branch_id,
            metadata: { request_id: requestRow.id, order_id: orderId, shift_id: shiftId, kitchen_status: 'void_requested' }
          }
        )
      )
    );

    await notificationService.notifyRole(
      'auditor',
      'POS void request raised',
      `${order.order_number || 'A POS bill'} void request raised — awaiting kitchen, then cashier, then branch accountant.`,
      {
        type: 'info',
        category: 'pos_void_request',
        priority: 'medium',
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

// Shared enrichment for all three pending-queue stages of the whole-bill
// void chain (kitchen / cashier / accountant) — same shape, different status
// filter and branch scoping per caller.
const fetchEnrichedPosVoidRequests = async (
  status: string,
  branchId: number | null,
  scopeToBranch: boolean,
  outletScope: KitchenOutletScope = null,
): Promise<Record<string, any>[]> => {
  let query = supabase
    .from('pos_void_requests')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (scopeToBranch) {
    if (branchId === null) return [];
    query = query.eq('branch_id', branchId);
  } else if (branchId !== null) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data || [];
  const orderIds = [...new Set(rows.map((row: any) => row.order_id).filter(Boolean))];
  const outletIds = [...new Set(rows.map((row: any) => row.outlet_id).filter(Boolean))];
  const branchIds = [...new Set(rows.map((row: any) => row.branch_id).filter(Boolean))];
  const userIds = [...new Set(rows.flatMap((row: any) => [row.requested_by, row.kitchen_id, row.cashier_id]).filter(Boolean))];

  const [ordersResult, outletsResult, branchesResult, usersResult] = await Promise.all([
    orderIds.length
      ? supabase.from('pos_shift_orders').select('id, order_number, customer_name, total_amount, amount_paid, balance_amount, items').in('id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    outletIds.length
      ? supabase.from('pos_outlets').select('id, name, outlet_type').in('id', outletIds)
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
  const filteredRows = outletScope
    ? rows.filter((row: any) =>
        matchesKitchenOutletScope(
          outletsById.get(row.outlet_id)?.outlet_type,
          outletScope,
        ),
      )
    : rows;
  return filteredRows.map((row: any) => {
    const order = ordersById.get(row.order_id) || {};
    const outlet = outletsById.get(row.outlet_id) || {};
    const branch = branchesById.get(row.branch_id) || {};
    const user = usersById.get(row.requested_by) || {};
    const kitchenUser = row.kitchen_id ? usersById.get(row.kitchen_id) : null;
    const cashierUser = row.cashier_id ? usersById.get(row.cashier_id) : null;
    const requestedByName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return {
      ...row,
      order_number: row.order_number || order.order_number,
      customer_name: order.customer_name,
      total_amount: order.total_amount,
      amount_paid: order.amount_paid,
      balance_amount: order.balance_amount,
      void_items: order.items || [],
      outlet_name: outlet.name,
      branch_name: branch.name,
      requested_by_email: user.email,
      requested_by_name: requestedByName || user.email,
      kitchen_name: kitchenUser ? `${kitchenUser.first_name || ''} ${kitchenUser.last_name || ''}`.trim() || kitchenUser.email : null,
      cashier_name: cashierUser ? `${cashierUser.first_name || ''} ${cashierUser.last_name || ''}`.trim() || cashierUser.email : null
    };
  });
};

// ── Stage 1: Kitchen (KDS) pending queue for whole-bill voids ──────────────
// Cashiers also get read-only visibility (no action endpoints are gated by
// this) so a bill that hasn't reached them yet doesn't look stuck/broken.
export const getPendingVoidsKitchenWholeBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (
      !KITCHEN_VOID_ROLES.has(roleFor(req)) &&
      !REVIEW_ROLES.has(roleFor(req)) &&
      !isCashierStationRole(roleFor(req), req.user?.branch_id) &&
      !isGlobalUser(req)
    ) {
      throw new AppError('Forbidden: kitchen access required', 403);
    }
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : branchIdFor(req);
    const outletScope = normalizeKitchenOutletScope(req.query.outlet_scope);
    const enriched = await fetchEnrichedPosVoidRequests('pending', branchId, !isGlobalUser(req), outletScope);
    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

// ── Stage 2: Cashier pending queue for whole-bill voids ────────────────────
export const getPendingVoidsCashierWholeBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isCashierStationRole(roleFor(req), req.user?.branch_id) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: cashier access required', 403);
    }
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : branchIdFor(req);
    const outletScope = normalizeKitchenOutletScope(req.query.outlet_scope);
    const enriched = await fetchEnrichedPosVoidRequests('kitchen_acknowledged', branchId, !isGlobalUser(req), outletScope);
    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

// ── Stage 3: Branch accountant final pending queue for whole-bill voids ────
export const getPendingPosVoidRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!REVIEW_ROLES.has(roleFor(req))) throw new AppError('Forbidden: accountant approval required', 403);
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : branchIdFor(req);
    const outletScope = normalizeKitchenOutletScope(req.query.outlet_scope);
    const enriched = await fetchEnrichedPosVoidRequests('cashier_acknowledged', branchId, !isGlobalUser(req), outletScope);
    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

// ── Stage 1: Kitchen (KDS) acknowledge/decline a whole-bill void request ───
// No financial effect yet — kitchen is only confirming the bill can be
// pulled before the cashier and accountant see it.

export const kitchenAcknowledgeVoidRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!KITCHEN_VOID_ROLES.has(roleFor(req)) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: kitchen acknowledgment required', 403);
    }
    const { requestId } = req.params;

    const { data: requestRow, error } = await supabase
      .from('pos_void_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);
    if (requestRow.status !== 'pending') throw new AppError('Void request already processed', 409);

    const now = new Date().toISOString();
    const { data: updatedRow, error: updateErr } = await supabase
      .from('pos_void_requests')
      .update({
        status: 'kitchen_acknowledged',
        kitchen_id: req.user.id,
        kitchen_acknowledged_at: now,
        kitchen_action: 'acknowledged',
        updated_at: now
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updateErr || !updatedRow) throw updateErr || new AppError('Void request already processed', 409);

    const { data: outletRow } = await supabase
      .from('pos_outlets')
      .select('outlet_type')
      .eq('id', requestRow.outlet_id)
      .maybeSingle();
    const cashierRoleToNotify = resolveStationCashierRole(outletRow?.outlet_type);
    const kitchenName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Kitchen';

    await Promise.allSettled([
      notificationService.notifyRole(
        cashierRoleToNotify,
        'Bill void awaiting cashier',
        `${requestRow.order_number || 'A POS bill'} — kitchen acknowledged the void. Acknowledge or decline.`,
        { type: 'warning', category: 'pos_void_request', priority: 'high', branchId: requestRow.branch_id,
          metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id } }
      ),
      requestRow.requested_by && notificationService.notifyUser(
        requestRow.requested_by,
        'Void acknowledged by kitchen',
        `Kitchen (${kitchenName}) acknowledged your void request for ${requestRow.order_number || 'the bill'}. Awaiting cashier.`,
        { type: 'info', category: 'pos_void_request', priority: 'medium',
          metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id } }
      ),
    ]);

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    next(error);
  }
};

export const kitchenDeclineVoidRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!KITCHEN_VOID_ROLES.has(roleFor(req)) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: kitchen action required', 403);
    }
    const { requestId } = req.params;
    const rejectionReason = String(req.body.rejection_reason || req.body.reason || '').trim();

    const { data: requestRow, error } = await supabase
      .from('pos_void_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);
    if (requestRow.status !== 'pending') throw new AppError('Void request already processed', 409);

    const now = new Date().toISOString();
    const { data: updatedRow, error: updateErr } = await supabase
      .from('pos_void_requests')
      .update({
        status: 'void_kitchen_declined',
        kitchen_id: req.user.id,
        kitchen_acknowledged_at: now,
        kitchen_action: 'declined',
        rejection_reason: rejectionReason || null,
        updated_at: now
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updateErr || !updatedRow) throw updateErr || new AppError('Void request already processed', 409);

    // Kitchen declined the void → the bill is valid and must be paid. Send it
    // straight back to the waiter as a normal, UNPAID active bill: clear the
    // void-pending state, restore each item out of 'void_requested' into the
    // active kitchen queue, and mark the order unpaid so it can be collected /
    // sent to the cashier for settlement.
    const { data: declinedOrder } = await supabase
      .from('pos_shift_orders')
      .select('items')
      .eq('id', requestRow.order_id)
      .single();
    const restoredItems = Array.isArray(declinedOrder?.items)
      ? declinedOrder.items.map((it: any) =>
          String(it?.kitchen_status || '').toLowerCase() === 'void_requested'
            ? { ...it, kitchen_status: 'pending' }
            : it)
      : declinedOrder?.items;

    await supabase
      .from('pos_shift_orders')
      .update({
        void_request_status: 'rejected',
        kitchen_status: 'pending',
        payment_status: 'unpaid',
        ...(restoredItems !== undefined ? { items: restoredItems } : {}),
        updated_at: now
      })
      .eq('id', requestRow.order_id);

    const kitchenName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Kitchen';
    if (requestRow.requested_by) {
      await notificationService.notifyUser(
        requestRow.requested_by,
        'Void declined — bill back to you (unpaid)',
        `Kitchen (${kitchenName}) declined the void for ${requestRow.order_number || 'the bill'}${rejectionReason ? `: ${rejectionReason}` : ''}. The bill is back with you as an UNPAID bill — collect payment or send it to the cashier.`,
        { type: 'warning', category: 'pos_void_request', priority: 'high',
          metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id, rejection_reason: rejectionReason } }
      );
    }

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    next(error);
  }
};

// ── Stage 2: Cashier acknowledge/decline a whole-bill void request ─────────
// Acknowledge applies the real financial effect (the heavy lifting that
// reviewPosVoidRequest used to do entirely on its own): stock reversal,
// kitchen-consumption reversal, inventory reversal, voiding the order, and
// reversing the cashier shift totals — so the cashier's own shift closes
// with the void already reflected. The branch accountant's later approval
// is a compliance sign-off and does not repeat any of this.

export const cashierAcknowledgeVoidRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isCashierStationRole(roleFor(req), req.user?.branch_id) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: cashier acknowledgment required', 403);
    }
    const { requestId } = req.params;

    const { data: requestRow, error } = await supabase
      .from('pos_void_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);

    const { data: outletRow } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', requestRow.outlet_id)
      .single();
    if (outletRow) {
      await ensureCashierOutletAccess(req, outletRow);
    }

    if (requestRow.status !== 'kitchen_acknowledged') {
      const hint = requestRow.status === 'pending'
        ? 'Void request has not been acknowledged by kitchen yet'
        : 'Void request already processed';
      throw new AppError(hint, 409);
    }

    const order = await loadShiftOrder(requestRow.shift_id, requestRow.order_id);
    const now = new Date().toISOString();

    const { data: updatedReqRow, error: updateRequestError } = await supabase
      .from('pos_void_requests')
      .update({
        status: 'cashier_acknowledged',
        cashier_id: req.user.id,
        cashier_acknowledged_at: now,
        cashier_action: 'acknowledged',
        updated_at: now
      })
      .eq('id', requestId)
      .eq('status', 'kitchen_acknowledged')
      .select('*')
      .single();
    if (updateRequestError || !updatedReqRow) throw updateRequestError || new AppError('Void request already processed', 409);

    await updateStockForItems(requestRow.shift_id, requestRow.outlet_id, Array.isArray(order.items) ? order.items : [], -1, requestRow.returned_to_stock !== false);
    await reverseKitchenConsumptionForOrder(requestRow.order_id).catch((consumptionError) =>
      logger.warn('cashierAcknowledgeVoidRequest: reverseKitchenConsumptionForOrder failed', consumptionError as any));
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
        voided_at: now,
        voided_by: req.user.id,
        void_reason: requestRow.reason,
        inventory_reversed_at: order.inventory_posted_at ? now : order.inventory_reversed_at || null,
        inventory_reversed_by: order.inventory_posted_at ? req.user.id : order.inventory_reversed_by || null,
        updated_at: now
      })
      .eq('id', requestRow.order_id);
    if (voidOrderError) throw voidOrderError;

    // Defensive reverse-increment guard. ensureEditableOrder currently blocks
    // voiding a paid bill, so amount_paid is almost always 0 here. This guard
    // future-proofs the system: if that restriction is ever relaxed or
    // bypassed, the shift totals will still reflect reality rather than
    // counting voided revenue forever — and lets the cashier close their
    // shift with the correct totals right away.
    if (numberValue(order.amount_paid) > 0) {
      const { error: reverseError } = await supabase.rpc('reverse_cashier_shift_for_order', {
        p_order_id: requestRow.order_id
      });
      if (reverseError) {
        logger.warn('cashierAcknowledgeVoidRequest: failed to reverse shift totals for voided order', {
          orderId: requestRow.order_id,
          amountPaid: order.amount_paid,
          error: reverseError.message
        });
      }
    }

    const cashierName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Cashier';
    const ackMeta = { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id };
    await Promise.allSettled([
      notificationService.notifyRole(
        'branch_accountant',
        'Bill void awaiting final approval',
        `${order.order_number || 'A POS bill'} was voided by cashier ${cashierName} — awaiting your final approval.`,
        { type: 'warning', category: 'pos_void_request', priority: 'high', branchId: requestRow.branch_id, metadata: ackMeta }
      ),
      requestRow.requested_by && notificationService.notifyUser(
        requestRow.requested_by,
        'Void acknowledged by cashier',
        `Cashier ${cashierName} voided ${order.order_number || 'your bill'}. Awaiting branch accountant final approval.`,
        { type: 'info', category: 'pos_void_request', priority: 'medium', metadata: ackMeta }
      ),
    ]);

    res.json({ success: true, data: updatedReqRow });
  } catch (error) {
    next(error);
  }
};

export const cashierDeclineVoidRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isCashierStationRole(roleFor(req), req.user?.branch_id) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: cashier action required', 403);
    }
    const { requestId } = req.params;
    const rejectionReason = String(req.body.rejection_reason || req.body.reason || '').trim();

    const { data: requestRow, error } = await supabase
      .from('pos_void_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (error || !requestRow) throw new AppError('Void request not found', 404);
    ensureBranchAccess(req, requestRow.branch_id);

    const { data: outletRow } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', requestRow.outlet_id)
      .single();
    if (outletRow) {
      await ensureCashierOutletAccess(req, outletRow);
    }

    if (requestRow.status !== 'kitchen_acknowledged') {
      const hint = requestRow.status === 'pending'
        ? 'Void request has not been acknowledged by kitchen yet'
        : 'Void request already processed';
      throw new AppError(hint, 409);
    }

    const now = new Date().toISOString();
    const { data: updatedRow, error: updateErr } = await supabase
      .from('pos_void_requests')
      .update({
        status: 'void_cashier_declined',
        cashier_id: req.user.id,
        cashier_acknowledged_at: now,
        cashier_action: 'declined',
        rejection_reason: rejectionReason || null,
        updated_at: now
      })
      .eq('id', requestId)
      .eq('status', 'kitchen_acknowledged')
      .select('*')
      .single();
    if (updateErr || !updatedRow) throw updateErr || new AppError('Void request already processed', 409);

    // Same as a kitchen decline: the void is refused, so the bill is valid and
    // goes back to the waiter as an UNPAID active bill (items restored out of
    // 'void_requested', order marked unpaid) to be collected / settled.
    const { data: declinedOrder } = await supabase
      .from('pos_shift_orders')
      .select('items')
      .eq('id', requestRow.order_id)
      .single();
    const restoredItems = Array.isArray(declinedOrder?.items)
      ? declinedOrder.items.map((it: any) =>
          String(it?.kitchen_status || '').toLowerCase() === 'void_requested'
            ? { ...it, kitchen_status: 'pending' }
            : it)
      : declinedOrder?.items;

    await supabase
      .from('pos_shift_orders')
      .update({
        void_request_status: 'rejected',
        kitchen_status: 'pending',
        payment_status: 'unpaid',
        ...(restoredItems !== undefined ? { items: restoredItems } : {}),
        updated_at: now
      })
      .eq('id', requestRow.order_id);

    const cashierName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Cashier';
    if (requestRow.requested_by) {
      await notificationService.notifyUser(
        requestRow.requested_by,
        'Void declined — bill back to you (unpaid)',
        `Cashier ${cashierName} declined the void for ${requestRow.order_number || 'the bill'}${rejectionReason ? `: ${rejectionReason}` : ''}. The bill is back with you as an UNPAID bill — collect payment or send it to the cashier.`,
        { type: 'warning', category: 'pos_void_request', priority: 'high',
          metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id, rejection_reason: rejectionReason } }
      );
    }

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    next(error);
  }
};

// ── Stage 3: Branch accountant final approval ───────────────────────────────
// The financial void already happened at Stage 2 (cashier acknowledge).
// Approve here is a compliance sign-off only. Reject flags the void as
// non-compliant for manual follow-up — by this point stock, kitchen
// consumption, inventory, and shift totals have already moved, so rejection
// does not attempt to silently auto-reverse them.

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
    if (requestRow.status !== 'cashier_acknowledged') {
      const hint = requestRow.status === 'pending' || requestRow.status === 'kitchen_acknowledged'
        ? 'Void request has not been acknowledged by the cashier yet'
        : 'Void request already processed';
      throw new AppError(hint, 409);
    }
    ensureBranchAccess(req, requestRow.branch_id);

    const order = await loadShiftOrder(requestRow.shift_id, requestRow.order_id);
    const now = new Date().toISOString();

    const { error: updateRequestError } = await supabase
      .from('pos_void_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewed_by: req.user.id,
        reviewed_at: now,
        rejection_reason: approved ? null : rejectionReason,
        updated_at: now
      })
      .eq('id', requestId)
      .eq('status', 'cashier_acknowledged');
    if (updateRequestError) throw updateRequestError;

    await supabase
      .from('pos_shift_orders')
      .update({ void_request_status: approved ? 'approved' : 'rejected', updated_at: now })
      .eq('id', requestRow.order_id);

    if (approved) {
      await notificationService.notifyRole(
        'auditor',
        'POS void approved',
        `${order.order_number || 'A POS bill'} void was given final approval and is fully closed out.`,
        {
          type: 'success',
          category: 'pos_void_request',
          priority: 'medium',
          branchId: requestRow.branch_id,
          metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id, void_reason: requestRow.reason }
        }
      );
      if (requestRow.requested_by) {
        await notificationService.notifyUser(
          requestRow.requested_by,
          'Void request APPROVED ✓',
          `Your void request for bill ${order.order_number || requestRow.order_id} received final approval.`,
          {
            type: 'success',
            category: 'pos_void_request',
            priority: 'medium',
            metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id }
          }
        );
      }
    } else {
      // Flag for manual follow-up rather than silently reversing — the void
      // (stock, kitchen consumption, inventory, shift totals) is already
      // applied by this point.
      await Promise.allSettled([
        notificationService.notifyRole(
          'auditor',
          'POS void flagged non-compliant',
          `${order.order_number || 'A POS bill'} void was REJECTED at final approval but the bill is already voided and shift totals already adjusted. Manual correction required.`,
          {
            type: 'error',
            category: 'pos_void_request',
            priority: 'high',
            branchId: requestRow.branch_id,
            metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id, rejection_reason: rejectionReason }
          }
        ),
        notificationService.notifyRole(
          'branch_manager',
          'POS void flagged non-compliant',
          `${order.order_number || 'A POS bill'} void was REJECTED by ${req.user.first_name || 'the accountant'} at final approval. Bill is already voided — manual correction required.`,
          {
            type: 'error',
            category: 'pos_void_request',
            priority: 'high',
            branchId: requestRow.branch_id,
            metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id, rejection_reason: rejectionReason }
          }
        ),
        requestRow.cashier_id && notificationService.notifyUser(
          requestRow.cashier_id,
          'Void flagged non-compliant',
          `The void you acknowledged for ${order.order_number || 'a bill'} was rejected at final approval${rejectionReason ? `: ${rejectionReason}` : ''}. It needs manual correction.`,
          { type: 'error', category: 'pos_void_request', priority: 'high',
            metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id, rejection_reason: rejectionReason } }
        ),
        requestRow.requested_by && notificationService.notifyUser(
          requestRow.requested_by,
          'Void request REJECTED at final approval',
          `Your void request for bill ${order.order_number || requestRow.order_id} was rejected at final approval${rejectionReason ? `: ${rejectionReason}` : ''}.`,
          {
            type: 'warning',
            category: 'pos_void_request',
            priority: 'medium',
            metadata: { request_id: requestId, order_id: requestRow.order_id, shift_id: requestRow.shift_id, rejection_reason: rejectionReason }
          }
        ),
      ]);
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
  // 'broken' means the item was physically broken/damaged and should NOT be
  // returned to stock — used to auto-set returned_to_stock=false server-side.
  'broken',
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

// Resolves which cashier role to notify once kitchen has acknowledged a void
// request, based on the outlet station type (same mapping requestItemVoid
// used to notify the cashier directly before the kitchen stage existed).
const resolveStationCashierRole = (outletType: unknown): string => {
  const type = String(outletType || '').toLowerCase();
  for (const [roleKey, outletTypes] of Object.entries(POS_STATION_CASHIER_ROLE_TYPES)) {
    if (outletTypes.includes(type)) return roleKey;
  }
  return 'cashier';
};

type KitchenOutletScope = 'restaurant' | 'choma_zone' | null;

const normalizeKitchenOutletScope = (value: unknown): KitchenOutletScope => {
  const scope = String(value || '').trim().toLowerCase();
  return scope === 'restaurant' || scope === 'choma_zone'
    ? (scope as KitchenOutletScope)
    : null;
};

const matchesKitchenOutletScope = (
  outletType: unknown,
  outletScope: KitchenOutletScope,
): boolean => {
  if (!outletScope) return true;
  return String(outletType || '').trim().toLowerCase() === outletScope;
};

const filterRowsByKitchenOutletScope = async <
  T extends { outlet_id?: string | null }
>(
  rows: T[],
  outletScope: KitchenOutletScope,
): Promise<T[]> => {
  if (!outletScope || !rows.length) return rows;

  const outletIds = Array.from(
    new Set(rows.map((row) => row.outlet_id).filter(Boolean) as string[]),
  );
  if (!outletIds.length) return [];

  const { data: outlets, error } = await supabase
    .from('pos_outlets')
    .select('id, outlet_type')
    .in('id', outletIds);
  if (error) throw error;

  const outletTypeById = new Map(
    (outlets || []).map((outlet: any) => [String(outlet.id), outlet.outlet_type]),
  );

  return rows.filter((row) =>
    matchesKitchenOutletScope(
      outletTypeById.get(String(row.outlet_id || '')),
      outletScope,
    ),
  );
};

// Restricts a pos_item_void_requests query to the calling cashier's own
// station (assigned outlets, active outlet, or outlet type) — same scoping
// getPendingVoidsCashier has always used for station-specific roles like
// main_bar_cashier/restaurant_cashier so they don't see other stations'
// requests. Shared with the kitchen-pending queue's read-only "awaiting
// kitchen" preview for cashiers (see getPendingVoidsKitchen).
const scopeQueryToCashierStation = async (
  query: any,
  req: Request,
  branchId: number | null
): Promise<any> => {
  const normalizedRole = roleFor(req);
  if (!isCashierStationRole(normalizedRole, branchId) || normalizedRole === 'cashier') {
    return query;
  }

  // 1. Try active open shifts first — but scope by the STATION (outlet), not
  //    the shift id: a request raised during a previous shift on this station
  //    must stay visible after that shift closes/rotates, or it can never be
  //    acknowledged while still blocking every cashier shift close in the
  //    branch (the close guard counts kitchen_acknowledged requests).
  const { data: myShifts } = await supabase
    .from('pos_outlet_shifts')
    .select('id, outlet_id')
    .eq('cashier_id', req.user.id)
    .eq('status', 'open');
  const myOutletIds = Array.from(new Set(
    (myShifts || []).map((s: any) => String(s.outlet_id || '')).filter(Boolean)
  ));
  if (myOutletIds.length > 0) {
    return query.in('outlet_id', myOutletIds);
  }

  // 2. Fall back to active_outlet_id
  const activeOutletId = (req.user as any)?.active_outlet_id || req.query.outlet_id;
  if (activeOutletId) {
    return query.eq('outlet_id', activeOutletId);
  }

  // 3. Fall back to assigned outlets
  const assignedOutlets = await loadAssignedPosOutlets(supabase, req.user?.id);
  const assignedIds = assignedOutlets.map((o) => o.id).filter(Boolean);
  if (assignedIds.length > 0) {
    return query.in('outlet_id', assignedIds);
  }

  // 4. Fall back to role-based outlet types
  const allowedTypes = stationTypesForCashierRole(normalizedRole, branchId);
  if (allowedTypes.length > 0) {
    const { data: outlets } = await supabase
      .from('pos_outlets')
      .select('id')
      .eq('branch_id', branchId)
      .in('outlet_type', allowedTypes);
    const outletIds = (outlets || []).map((o: any) => o.id);
    if (outletIds.length > 0) {
      return query.in('outlet_id', outletIds);
    }
  }
  return query.eq('outlet_id', '00000000-0000-0000-0000-000000000000');
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

    // One open request per bill line. 'kitchen_acknowledged' counts as open
    // too — checking only 'pending' let waiters re-request the same item the
    // moment kitchen acknowledged, stacking duplicates the cashier could
    // never apply ("Void quantity exceeds the remaining active quantity").
    const { data: existingOpen, error: existingError } = await supabase
      .from('pos_item_void_requests')
      .select('id, status, qty_to_void')
      .eq('order_id', orderId)
      .eq('item_index', itemIndex)
      .in('status', ['pending', 'kitchen_acknowledged'])
      .limit(1);
    if (existingError) throw existingError;
    if (existingOpen && existingOpen.length > 0) {
      const stage = existingOpen[0].status === 'pending' ? 'kitchen' : 'cashier';
      throw new AppError(
        `A void request for this item is already awaiting ${stage} action — wait for it to be processed or ask the ${stage} to decline it first`,
        409
      );
    }

    // Server-side: if the item was marked as 'broken', it was physically
    // damaged and must NOT return to stock — we override any frontend flag.
    const returnedToStock = reasonCategory !== 'broken';

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
        status: 'pending',
        returned_to_stock: returnedToStock
      })
      .select('*')
      .single();
    if (error || !requestRow) throw error || new AppError('Failed to create item void request', 500);

    // Stage 1 of the chain: kitchen (KDS) must acknowledge before the cashier
    // ever sees this request. The cashier is notified later, once kitchen
    // acknowledges (see kitchenAcknowledgeItemVoid).
    const voidNotifMeta = {
      request_id: requestRow.id,
      order_id: orderId,
      order_number: order.order_number,
      shift_id: shiftId,
      item_name: String(item.name || ''),
      qty_to_void: qtyToVoid
    };
    const voidNotifTitle = 'Item void request';
    const voidNotifMsg = `${String(item.name || 'An item')} on bill ${order.order_number || orderId} — void requested (qty: ${qtyToVoid}). Acknowledge or decline in KDS.`;
    const voidNotifOpts = { type: 'warning' as const, category: 'pos_item_void_request', priority: 'high' as const, metadata: voidNotifMeta };
    await Promise.allSettled(
      KITCHEN_VOID_NOTIFY_ROLES.map((role) =>
        notificationService.notifyRole(role, voidNotifTitle, voidNotifMsg, { ...voidNotifOpts, branchId: (shift as any).branch_id })
      )
    );

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

    // The financial void already happened at Stage 1 (cashier acknowledge).
    // Approval here is a compliance sign-off: clear the void_pending_approval
    // flag so the item is no longer marked "awaiting manager", and write the
    // append-only audit log row now that the void is officially approved.
    const now = new Date().toISOString();

    const { data: orderData, error: orderErr } = await supabase
      .from('pos_shift_orders')
      .select('id, items, outlet_id, short_code')
      .eq('id', requestRow.order_id)
      .single();
    if (orderErr || !orderData) throw new AppError('Order not found', 404);

    const items = Array.isArray(orderData.items) ? [...orderData.items] as Array<Record<string, any>> : [];
    const item = items[requestRow.item_index];
    if (!item) throw new AppError('Item no longer exists on this bill', 404);
    items[requestRow.item_index] = { ...item, void_pending_approval: false };

    const { data: updatedOrder, error: orderUpdateErr } = await supabase
      .from('pos_shift_orders')
      .update({
        items,
        bill_reprint_count: 0,
        updated_at: now
      })
      .eq('id', requestRow.order_id)
      .select('*')
      .single();
    if (orderUpdateErr) throw orderUpdateErr;

    const { data: outletRow } = await supabase
      .from('pos_outlets')
      .select('outlet_type')
      .eq('id', orderData.outlet_id)
      .maybeSingle();

    const unitPrice = Number(item.unit_price ?? requestRow.unit_price ?? 0);
    const qtyAfterVoid = Number(item.active_qty ?? 0);
    const qtyVoided = Number(requestRow.qty_to_void ?? 0);
    const qtyBeforeVoid = qtyAfterVoid + qtyVoided;

    // Update stock levels: reverse the sales decrement for the voided quantity
    await updateStockForItems(requestRow.shift_id, requestRow.outlet_id, [{ ...item, qty: qtyVoided }], -1, requestRow.returned_to_stock !== false);

    const { error: logError } = await supabase.from('pos_item_void_log').insert({
      void_request_id: requestRow.id,
      shift_id: requestRow.shift_id,
      order_id: requestRow.order_id,
      item_index: requestRow.item_index,
      item_name: requestRow.item_name,
      unit_price: unitPrice,
      qty_before_void: qtyBeforeVoid,
      qty_voided: qtyVoided,
      qty_after_void: qtyAfterVoid,
      amount_voided: qtyVoided * unitPrice,
      authorized_by: req.user.id,
      requested_by: requestRow.requested_by,
      void_reason: requestRow.reason,
      reason_category: requestRow.reason_category,
      branch_id: requestRow.branch_id,
      outlet_type: outletRow?.outlet_type || null,
      bill_code: orderData.short_code || null,
      voided_at: now,
      returned_to_stock: requestRow.returned_to_stock !== false
    });
    if (logError) throw logError;

    const { data: approvedReq, error: approveUpdateErr } = await supabase
      .from('pos_item_void_requests')
      .update({
        status: 'approved',
        actioned_by: req.user.id,
        actioned_at: now,
        manager_id: req.user.id,
        manager_reviewed_at: now,
        updated_at: now
      })
      .eq('id', id)
      .eq('status', 'void_acknowledged')
      .select('*')
      .single();
    if (approveUpdateErr || !approvedReq) {
      throw approveUpdateErr || new AppError('Void request already processed', 409);
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

    // Reinstate the item and reverse the financial void that Stage 1 (cashier
    // acknowledge) already applied: restore the item's quantity/total fields
    // and add the voided amount back onto the bill's total/balance.
    const { data: orderData } = await supabase
      .from('pos_shift_orders')
      .select('items, total_amount, balance_amount')
      .eq('id', requestRow.order_id)
      .single();

    if (orderData && Array.isArray(orderData.items)) {
      const items = [...orderData.items] as Array<Record<string, any>>;
      const item = items[requestRow.item_index];
      if (item) {
        const unitPrice = Number(item.unit_price ?? requestRow.unit_price ?? 0);
        const qtyToVoid = Number(requestRow.qty_to_void ?? 0);
        const voidedQtyAfterReversal = Math.max(Number(item.voided_qty ?? 0) - qtyToVoid, 0);
        const quantity = Number(item.quantity ?? 0);
        const activeQtyAfterReversal = quantity - voidedQtyAfterReversal;
        const amountRestored = qtyToVoid * unitPrice;

        items[requestRow.item_index] = {
          ...item,
          voided_qty: voidedQtyAfterReversal,
          active_qty: activeQtyAfterReversal,
          is_fully_voided: activeQtyAfterReversal <= 0,
          active_total: activeQtyAfterReversal * unitPrice,
          void_pending_approval: false
        };

        await supabase
          .from('pos_shift_orders')
          .update({
            items,
            total_amount: Number(orderData.total_amount || 0) + amountRestored,
            balance_amount: Number(orderData.balance_amount || 0) + amountRestored,
            bill_reprint_count: 0,
            updated_at: now
          })
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

// ── Stage 1: Kitchen (KDS) acknowledge/decline ─────────────────────────────
// The waiter's request lands here first. Kitchen must acknowledge before the
// cashier is even notified — no financial effect happens at this stage.

export const kitchenAcknowledgeItemVoid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!KITCHEN_VOID_ROLES.has(roleFor(req)) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: kitchen acknowledgment required', 403);
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
    const { data: updatedRow, error: updateErr } = await supabase
      .from('pos_item_void_requests')
      .update({
        status: 'kitchen_acknowledged',
        kitchen_id: req.user.id,
        kitchen_acknowledged_at: now,
        kitchen_action: 'acknowledged',
        updated_at: now
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updateErr || !updatedRow) throw updateErr || new AppError('Void request already actioned', 409);

    const { data: outletRow } = await supabase
      .from('pos_outlets')
      .select('outlet_type')
      .eq('id', requestRow.outlet_id)
      .maybeSingle();
    const cashierRoleToNotify = resolveStationCashierRole(outletRow?.outlet_type);

    const kitchenName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Kitchen';
    const ackMeta = { request_id: id, order_id: requestRow.order_id, shift_id: requestRow.shift_id };
    await Promise.allSettled([
      requestRow.requested_by && notificationService.notifyUser(
        requestRow.requested_by,
        'Void acknowledged by kitchen',
        `Kitchen (${kitchenName}) acknowledged the void for "${requestRow.item_name}" on bill ${requestRow.order_number || ''}. Awaiting cashier.`,
        { type: 'info', category: 'pos_item_void_request', priority: 'medium', metadata: ackMeta }
      ),
      notificationService.notifyRole(
        cashierRoleToNotify,
        'Item void awaiting cashier',
        `"${requestRow.item_name}" on bill ${requestRow.order_number || ''} — kitchen acknowledged void. Acknowledge or decline.`,
        { type: 'warning', category: 'pos_item_void_request', priority: 'high', branchId: requestRow.branch_id, metadata: ackMeta }
      ),
    ]);

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    next(error);
  }
};

export const kitchenDeclineItemVoid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!KITCHEN_VOID_ROLES.has(roleFor(req)) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
      throw new AppError('Forbidden: kitchen action required', 403);
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
    const { data: updatedRow, error: updateErr } = await supabase
      .from('pos_item_void_requests')
      .update({
        status: 'void_kitchen_declined',
        kitchen_id: req.user.id,
        kitchen_acknowledged_at: now,
        kitchen_action: 'declined',
        updated_at: now
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updateErr || !updatedRow) throw updateErr || new AppError('Void request already actioned', 409);

    const kitchenName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Kitchen';
    if (requestRow.requested_by) {
      await notificationService.notifyUser(
        requestRow.requested_by,
        'Void request declined by kitchen',
        `Kitchen (${kitchenName}) declined the void for "${requestRow.item_name}" on bill ${requestRow.order_number || ''} — item stays on the bill.`,
        { type: 'error', category: 'pos_item_void_request', priority: 'medium',
          metadata: { request_id: id, order_id: requestRow.order_id } }
      );
    }

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    next(error);
  }
};

// ── Stage 2: Cashier acknowledge/decline ───────────────────────────────────
// Financial effect is applied here (bill total/balance reduced) so the
// cashier's shift totals are correct by the time they close their shift.

export const cashierAcknowledgeItemVoid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!isCashierStationRole(roleFor(req), req.user?.branch_id) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
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

    // Ensure this cashier is authorized to access the specific outlet of the request
    const { data: outletRow } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', requestRow.outlet_id)
      .single();
    if (outletRow) {
      await ensureCashierOutletAccess(req, outletRow);
    }

    if (requestRow.status !== 'kitchen_acknowledged') {
      const hint = requestRow.status === 'pending'
        ? 'Void request has not been acknowledged by kitchen yet'
        : 'Void request already actioned';
      throw new AppError(hint, 409);
    }

    const now = new Date().toISOString();

    // Stage 1 now performs the real financial void — the bill is already in
    // the customer's hand once the cashier acknowledges, so the total can't
    // wait for manager approval. This recalculates total_amount/balance_amount
    // and flags the item void_pending_approval=true (still hidden from the
    // customer-facing line list until the manager signs off in Stage 2).
    const { data: updatedOrder, error: rpcError } = await supabase.rpc('cashier_acknowledge_item_void', {
      p_request_id: id,
      p_actioned_by: req.user.id
    });
    if (rpcError) {
      const rpcMessage = String(rpcError.message || '');
      if (rpcMessage.includes('already processed')) {
        throw new AppError('Void request already actioned', 409);
      }
      // Stale request: the item was already voided through another (usually
      // duplicate) request, so this one can never apply. Auto-decline it so
      // it stops clogging the cashier queue instead of erroring forever.
      if (rpcMessage.includes('exceeds the remaining active quantity') ||
          rpcMessage.includes('Item no longer exists')) {
        await supabase
          .from('pos_item_void_requests')
          .update({
            status: 'void_cashier_declined',
            cashier_id: req.user.id,
            cashier_acknowledged_at: now,
            cashier_action: 'declined',
            updated_at: now
          })
          .eq('id', id)
          .eq('status', 'kitchen_acknowledged');
        throw new AppError(
          'This item was already voided by another request — the duplicate has been removed from the queue',
          409
        );
      }
      throw rpcError;
    }

    const { data: updatedReq, error: reqFetchErr } = await supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (reqFetchErr) throw reqFetchErr;

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
    if (!isCashierStationRole(roleFor(req), req.user?.branch_id) && !REVIEW_ROLES.has(roleFor(req)) && !isGlobalUser(req)) {
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

    // Ensure this cashier is authorized to access the specific outlet of the request
    const { data: outletRow } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('id', requestRow.outlet_id)
      .single();
    if (outletRow) {
      await ensureCashierOutletAccess(req, outletRow);
    }

    if (requestRow.status !== 'kitchen_acknowledged') {
      const hint = requestRow.status === 'pending'
        ? 'Void request has not been acknowledged by kitchen yet'
        : 'Void request already actioned';
      throw new AppError(hint, 409);
    }

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

// ── Kitchen Stage 1 queue ───────────────────────────────────────────────────

export const getPendingVoidsKitchen = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const branchId = branchIdFor(req);
    const outletScope = normalizeKitchenOutletScope(req.query.outlet_scope);

    let query = supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (branchId) query = query.eq('branch_id', branchId);

    // Cashiers get read-only visibility into what's still awaiting kitchen
    // (scoped to their own station) so a request that hasn't reached them
    // yet doesn't look broken/stuck — they just can't act on it here.
    query = await scopeQueryToCashierStation(query, req, branchId);

    const { data, error } = await query;
    if (error) throw error;

    const rows = await filterRowsByKitchenOutletScope(data || [], outletScope);
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

export const getPendingVoidsCashier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const branchId = branchIdFor(req);

    let query = supabase
      .from('pos_item_void_requests')
      .select('*')
      .eq('status', 'kitchen_acknowledged')
      .order('created_at', { ascending: true });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // Specific cashier station roles (e.g. main_bar_cashier, restaurant_cashier)
    // should only see void requests relevant to their assigned/active outlet stations.
    // Managers, accountants, auditors, and general cashiers ('cashier') can see all.
    query = await scopeQueryToCashierStation(query, req, branchId);

    const { data, error } = await query;
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
  isCashierStationRole(roleFor(req), req.user?.branch_id) || roleFor(req) === 'super_admin';

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

    // Update stock levels: return old items to stock (reverse sale) and deduct new items (normal sale)
    if (Array.isArray(requestRow.old_items) && requestRow.old_items.length > 0) {
      await updateStockForItems(requestRow.shift_id, requestRow.outlet_id, requestRow.old_items, -1);
    }
    if (Array.isArray(requestRow.new_items) && requestRow.new_items.length > 0) {
      await updateStockForItems(requestRow.shift_id, requestRow.outlet_id, requestRow.new_items, 1);
    }

    // Kitchen consumption: reverse the returned item(s)' share on the original
    // order, then link the replacement item(s) to the new linked order exactly
    // like a fresh sale — same best-effort, never-blocks-approval semantics as
    // recordKitchenConsumption() above.
    await Promise.allSettled(
      (Array.isArray(requestRow.old_items) ? requestRow.old_items : []).map((oldItem: any) =>
        reverseKitchenConsumptionForOrder(requestRow.order_id, { itemIndex: oldItem.item_index, qtyToReverse: numberValue(oldItem.quantity) })
          .catch((consumptionError) => logger.warn('approveItemExchange: reverseKitchenConsumptionForOrder failed', consumptionError as any))
      )
    );
    if (Array.isArray(requestRow.new_items) && requestRow.new_items.length > 0) {
      await recordKitchenConsumption(requestRow.new_items, Number(requestRow.branch_id), requestRow.shift_id, newOrder.id)
        .catch((consumptionError) => logger.warn('approveItemExchange: recordKitchenConsumption failed', consumptionError as any));
    }

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
    if (!REVIEW_ROLES.has(roleFor(req)) && !isCashierStationRole(roleFor(req), req.user?.branch_id)) {
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

// ── Master bills (one customer bill across outlets) ─────────────────────────
// A customer seated at one outlet orders drinks at the bar, food at the
// restaurant and a platter from Choma. Each is its own pos_shift_orders row in
// its OWN outlet shift (so prep printing, stock and revenue stay per outlet),
// grouped under ONE pos_master_bills row with a single bill number. The origin
// cashier collects the whole amount; each outlet cashier confirms their part.

const orderIsOwnedBy = (order: Record<string, any>, userId: string): boolean =>
  String(order.waiter_id || '') === userId || String(order.created_by || '') === userId;

async function loadCashierSettledMasterBillIds(masterBillIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(masterBillIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (ids.length === 0) return new Set<string>();
  const { rows } = await db.query(
    `
      select distinct coalesce(reference_id::text, source_document_id::text) as master_bill_id
      from cashier_transactions
      where (
        reference_type = 'pos_master_bills'
        and reference_id = any($1::uuid[])
      ) or (
        source_document_type = 'pos_master_bills'
        and source_document_id = any($1::uuid[])
      )
    `,
    [ids]
  );
  return new Set(
    rows
      .map((row: Record<string, any>) => String(row.master_bill_id || '').trim())
      .filter(Boolean)
  );
}

// Shape a raw order row (optionally with a joined outlet) for the bill views.
const mapOrderForBill = (order: Record<string, any>): Record<string, any> => {
  const outlet = Array.isArray(order.outlet) ? order.outlet[0] : order.outlet;
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    id: order.id,
    order_number: order.order_number,
    short_code: order.short_code,
    outlet_id: order.outlet_id,
    outlet_type: outlet?.outlet_type || null,
    outlet_name: outlet?.name || null,
    shift_id: order.shift_id,
    waiter_id: order.waiter_id,
    waiter_name: order.waiter_name,
    customer_name: order.customer_name || 'Walk-in',
    table_number: order.table_number ?? null,
    room_number: order.room_number ?? null,
    status: order.status,
    payment_status: order.payment_status,
    kitchen_status: order.kitchen_status,
    total_amount: numberValue(order.total_amount),
    amount_paid: numberValue(order.amount_paid),
    balance_amount: Math.max(0, numberValue(order.balance_amount) || numberValue(order.total_amount) - numberValue(order.amount_paid)),
    master_bill_id: order.master_bill_id || null,
    sub_bill_status: order.sub_bill_status || 'open',
    items_count: items.length,
    items,
    created_at: order.created_at
  };
};

// Per-outlet breakdown (sub-bills) for a master bill's member orders.
const outletBreakdown = (mapped: Array<Record<string, any>>): Array<Record<string, any>> => {
  const byOutlet = new Map<string, Record<string, any>>();
  for (const o of mapped) {
    const key = String(o.outlet_id || '');
    const e = byOutlet.get(key) || {
      outlet_id: o.outlet_id, outlet_name: o.outlet_name, outlet_type: o.outlet_type,
      amount: 0, balance: 0, order_ids: [] as string[]
    };
    e.amount += numberValue(o.total_amount);
    e.balance += numberValue(o.balance_amount);
    e.order_ids.push(o.id);
    byOutlet.set(key, e);
  }
  return Array.from(byOutlet.values());
};

// Present a standalone (un-grouped) order as a one-outlet bill card.
const standaloneBillView = (order: Record<string, any>): Record<string, any> => {
  const o = mapOrderForBill(order);
  return {
    id: o.id,
    master_bill_id: null,
    master_bill_number: null,
    is_master: false,
    is_consolidated: false,
    label: o.customer_name || o.short_code || 'Bill',
    customer_name: o.customer_name,
    table_number: o.table_number,
    origin_outlet_id: o.outlet_id,
    origin_outlet_name: o.outlet_name,
    waiter_id: o.waiter_id,
    waiter_name: o.waiter_name,
    status: 'open',
    outlets: o.outlet_name ? [o.outlet_name] : [],
    outlet_breakdown: outletBreakdown([o]),
    order_count: 1,
    total_amount: o.total_amount,
    amount_paid: o.amount_paid,
    balance_amount: o.balance_amount,
    payment_status: o.payment_status,
    created_at: o.created_at,
    orders: [o]
  };
};

// Assemble a master bill row + its member orders into the full bill view.
const buildMasterBillView = (
  master: Record<string, any>,
  orders: Array<Record<string, any>>
): Record<string, any> => {
  const mapped = orders.map(mapOrderForBill);
  const total = mapped.reduce((s, o) => s + numberValue(o.total_amount), 0);
  const paid = mapped.reduce((s, o) => s + numberValue(o.amount_paid), 0);
  const balance = mapped.reduce((s, o) => s + numberValue(o.balance_amount), 0);
  const breakdown = outletBreakdown(mapped);
  return {
    id: master.id,
    master_bill_id: master.id,
    master_bill_number: master.master_bill_number,
    is_master: true,
    is_consolidated: breakdown.length > 1,
    label: master.table_number
      ? `Table ${master.table_number}`
      : (master.customer_name || master.master_bill_number),
    customer_name: master.customer_name || 'Walk-in',
    table_number: master.table_number,
    origin_outlet_id: master.origin_outlet_id,
    origin_outlet_name: master.origin_outlet_name,
    waiter_id: master.opening_waiter_id,
    waiter_name: master.opening_waiter_name,
    status: master.status,
    settlement_cashier_id: master.settlement_cashier_id,
    settlement_cashier_name: master.settlement_cashier_name,
    payment_method: master.payment_method,
    outlets: Array.from(new Set(mapped.map((o) => o.outlet_name).filter(Boolean))),
    outlet_breakdown: breakdown,
    order_count: mapped.length,
    total_amount: total,
    amount_paid: paid,
    balance_amount: balance,
    payment_status: balance <= 0.01 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
    created_at: master.created_at,
    orders: mapped
  };
};

// Recompute a master bill's total and rebuild its per-outlet settlement rows
// from its current member orders. Called after link / add / unlink.
const recomputeMasterBillTotals = async (masterBillId: string): Promise<void> => {
  const { data: master } = await supabase
    .from('pos_master_bills').select('*').eq('id', masterBillId).maybeSingle();
  if (!master) return;
  const { data: orderRows } = await supabase
    .from('pos_shift_orders')
    .select('id, outlet_id, total_amount, amount_paid, outlet:pos_outlets(name)')
    .eq('master_bill_id', masterBillId)
    .not('status', 'eq', 'cancelled');
  const orders = (orderRows || []) as Array<Record<string, any>>;
  const total = orders.reduce((s, o) => s + numberValue(o.total_amount), 0);
  const paid = orders.reduce((s, o) => s + numberValue(o.amount_paid), 0);
  await supabase.from('pos_master_bills')
    .update({ total_amount: total, amount_paid: paid, updated_at: new Date().toISOString() })
    .eq('id', masterBillId);

  // Rebuild per-outlet settlement allocations (amounts only; confirm state kept).
  const byOutlet = new Map<string, { amount: number; name: string | null }>();
  for (const o of orders) {
    const outlet = Array.isArray(o.outlet) ? o.outlet[0] : o.outlet;
    const key = String(o.outlet_id || '');
    const e = byOutlet.get(key) || { amount: 0, name: outlet?.name || null };
    e.amount += numberValue(o.total_amount);
    byOutlet.set(key, e);
  }
  for (const [outletId, info] of Array.from(byOutlet.entries())) {
    await supabase.from('pos_master_bill_settlements').upsert({
      master_bill_id: masterBillId,
      branch_id: Number(master.branch_id),
      outlet_id: outletId,
      outlet_name: info.name,
      amount: info.amount,
      is_origin: String(outletId) === String(master.origin_outlet_id),
      updated_at: new Date().toISOString()
    }, { onConflict: 'master_bill_id,outlet_id' });
  }
};

// Generate a unique mixed letter+number bill code (same format POS orders use,
// e.g. A7K3M9) for a combined "customer bill", retrying on the rare collision.
const generateMasterBillShortCode = async (
  branchId: number,
  outletId: string,
  userId: string
): Promise<string> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { code } = await createBillVerificationCode({
      code: null,
      billRef: `MB-${Date.now()}`,
      billType: 'master_bill',
      branchId,
      outletId,
      amount: 0,
      generatedBy: userId
    });
    const { data: clashMaster } = await supabase
      .from('pos_master_bills').select('id').eq('master_bill_number', code).maybeSingle();
    if (clashMaster) continue;
    // Also avoid clashing with a live POS order's short code so a lookup never
    // resolves to two different bills.
    const { data: clashOrder } = await supabase
      .from('pos_shift_orders').select('id').eq('short_code', code).limit(1).maybeSingle();
    if (!clashOrder) return code;
  }
  // Extremely unlikely fallback — still letter+number and unique enough.
  return `MB${Date.now().toString(36).toUpperCase().slice(-5)}`;
};

// Load a master bill's full view (row + ALL its member orders).
const loadMasterBillView = async (masterBillId: string): Promise<Record<string, any> | null> => {
  const { data: master } = await supabase
    .from('pos_master_bills').select('*').eq('id', masterBillId).maybeSingle();
  if (!master) return null;
  const { data: orders } = await supabase
    .from('pos_shift_orders')
    .select('*, outlet:pos_outlets(id, name, outlet_type)')
    .eq('master_bill_id', masterBillId)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: true });
  return buildMasterBillView(master, (orders || []) as Array<Record<string, any>>);
};

// Settle the remaining balance of ONE order with a single tender. Records the
// payment against the order's OWN shift/outlet (so revenue + stock post to the
// correct outlet) and posts the inventory sale. Used by the consolidated
// one-tap bill settlement; payShiftOrder keeps its own richer per-order path
// (partial amounts, staff credit bills).
const settleOrderBalance = async (params: {
  order: Record<string, any>;
  shift: Record<string, any>;
  method: PaymentMethod;
  amount: number;
  receivedBy: string;
  reference?: string | null;
}): Promise<{ payment: any; amount_paid: number; balance_amount: number; payment_status: string }> => {
  const { order, shift, method, receivedBy } = params;
  const currentPaid = numberValue(order.amount_paid);
  const totalAmount = numberValue(order.total_amount);
  const currentBalance = Math.max(0, numberValue(order.balance_amount) || totalAmount - currentPaid);
  const amount = Math.min(params.amount > 0 ? params.amount : currentBalance, currentBalance);
  if (amount <= 0) throw new AppError('Payment amount must be greater than zero', 400);

  const { data: payment, error: paymentError } = await supabase
    .from('pos_shift_payments')
    .insert({
      shift_id: order.shift_id,
      outlet_id: order.outlet_id ?? shift.outlet_id,
      order_id: order.id,
      payment_method: method,
      amount,
      reference: params.reference || `POS-${method}-${Date.now()}`,
      received_by: receivedBy
    })
    .select('*')
    .single();
  if (paymentError || !payment) throw paymentError || new AppError('Failed to record payment', 500);

  const newPaid = currentPaid + amount;
  const newBalance = Math.max(0, totalAmount - newPaid);
  const isCleared = newBalance <= 0.01;
  const nextPaymentStatus = isCleared ? 'paid' : 'partial';
  const nextStatus = isCleared ? 'paid' : 'open';

  const orderItems = Array.isArray(order.items) ? order.items as Array<Record<string, any>> : [];
  if (isCleared && !order.inventory_posted_at) {
    await assertPosStockAvailable(Number(shift.branch_id), order.outlet_id ?? shift.outlet_id, orderItems);
  }

  await supabase
    .from('pos_shift_orders')
    .update({
      status: nextStatus,
      payment_status: nextPaymentStatus,
      amount_paid: newPaid,
      balance_amount: newBalance,
      payment_method: method,
      updated_at: new Date().toISOString()
    })
    .eq('id', order.id);

  if (isCleared && !order.inventory_posted_at) {
    await postPosInventorySale({
      branchId: Number(shift.branch_id),
      outletId: order.outlet_id ?? shift.outlet_id,
      shiftId: order.shift_id,
      orderId: order.id,
      items: orderItems,
      actorId: receivedBy
    });
    await supabase
      .from('pos_shift_orders')
      .update({ inventory_posted_at: new Date().toISOString(), inventory_posted_by: receivedBy })
      .eq('id', order.id);
  }

  return { payment, amount_paid: newPaid, balance_amount: newBalance, payment_status: nextPaymentStatus };
};

// GET /pos/waiter/open-bills — every unsettled order the CURRENT waiter owns,
// across ALL their outlets in the branch, folded into consolidated bills.
export const getWaiterOpenBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const branchId = branchIdFor(req);
    const requestedWaiter = nullableText(req.query.waiter_id);
    const requestedShiftId = nullableText(req.query.shift_id || req.query.shiftId);
    const ownerScoped = shouldScopeOrdersToOwner(req);
    const targetWaiterId = ownerScoped
      ? String(req.user.id)
      : (requestedWaiter && (canManageOutlets(req) || isGlobalUser(req)))
          ? requestedWaiter
          : null;

    let query = supabase
      .from('pos_shift_orders')
      .select('*, outlet:pos_outlets(id, name, outlet_type)')
      .in('payment_status', ['unpaid', 'partial'])
      .not('status', 'in', '(cancelled,voided)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (targetWaiterId) {
      query = query.or(`waiter_id.eq.${targetWaiterId},created_by.eq.${targetWaiterId}`);
    }
    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw error;

    const orders = (data || []).filter((o: any) => {
      const outlet = Array.isArray(o.outlet) ? o.outlet[0] : o.outlet;
      return isFoodOrBarOutlet(outlet?.outlet_type);
    });

    // Group the waiter's orders into master bills; ungrouped orders show as
    // standalone one-outlet cards they can combine.
    const masterIds = Array.from(new Set(orders.map((o: any) => o.master_bill_id).filter(Boolean)));
    const mastersById = new Map<string, any>();
    if (masterIds.length) {
      const { data: masters } = await supabase.from('pos_master_bills').select('*').in('id', masterIds);
      for (const m of (masters || [])) mastersById.set(String(m.id), m);
    }
    const byMaster = new Map<string, any[]>();
    const standalone: any[] = [];
    for (const o of orders) {
      const mid = o.master_bill_id ? String(o.master_bill_id) : null;
      if (mid && mastersById.has(mid)) {
        if (!byMaster.has(mid)) byMaster.set(mid, []);
        byMaster.get(mid)!.push(o);
      } else {
        standalone.push(o);
      }
    }
    const bills: any[] = [];
    for (const [mid, ords] of Array.from(byMaster.entries())) {
      bills.push(buildMasterBillView(mastersById.get(mid), ords));
    }
    for (const o of standalone) bills.push(standaloneBillView(o));
    bills.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    res.json({ success: true, data: bills });
  } catch (error) {
    next(error);
  }
};

// GET /pos/bills/:masterBillId — one master bill: all member orders across
// outlets + combined total + per-outlet sub-bill breakdown.
export const getConsolidatedBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { masterBillId } = req.params;
    const { data: master } = await supabase
      .from('pos_master_bills').select('branch_id').eq('id', masterBillId).maybeSingle();
    if (!master) throw new AppError('Master bill not found', 404);
    ensureBranchAccess(req, (master as any).branch_id);

    const view = await loadMasterBillView(masterBillId);
    if (!view) throw new AppError('Master bill not found', 404);
    if (shouldScopeOrdersToOwner(req)) {
      const mine = view.orders.every((o: any) => String(o.waiter_id || '') === String(req.user.id));
      if (!mine) throw new AppError('Forbidden: bill belongs to another waiter', 403);
    }
    res.json({ success: true, data: view });
  } catch (error) {
    next(error);
  }
};

// POST /pos/bills/link — link the given orders into ONE consolidated bill.
// body: { order_ids: string[], anchor_order_id?, label? }
export const linkOrdersIntoBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const orderIds: string[] = Array.isArray(req.body.order_ids)
      ? req.body.order_ids.map((id: any) => String(id)).filter(Boolean)
      : [];
    const anchorId = nullableText(req.body.anchor_order_id);
    const allIds = Array.from(new Set([...(anchorId ? [anchorId] : []), ...orderIds]));
    if (allIds.length < 2) throw new AppError('Select at least two orders to combine into one bill', 400);

    const { data: orders, error } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .in('id', allIds);
    if (error) throw error;
    if (!orders || orders.length !== allIds.length) throw new AppError('One or more orders were not found', 404);

    const userId = String(req.user.id);
    const ownerScoped = shouldScopeOrdersToOwner(req);
    const branchId = Number((orders[0] as any).branch_id);
    for (const o of orders as Array<Record<string, any>>) {
      ensureBranchAccess(req, o.branch_id);
      if (Number(o.branch_id) !== branchId) throw new AppError('All orders must belong to the same branch', 400);
      if (ownerScoped && !orderIsOwnedBy(o, userId)) throw new AppError('You can only combine your own orders', 403);
      if (['paid', 'credit_bill', 'voided'].includes(String(o.payment_status))) {
        throw new AppError('Cannot combine an order that is already settled or voided', 409);
      }
      if (['cancelled', 'voided'].includes(String(o.status))) {
        throw new AppError('Cannot combine a cancelled or voided order', 409);
      }
    }

    // Reuse an existing master bill if the anchor (or any member) has one; else
    // open a new one with a per-branch bill number (e.g. KYO-000245). The origin
    // outlet is where the anchor order lives (where the customer is seated).
    const anchor = (anchorId ? (orders as any[]).find((o) => String(o.id) === anchorId) : null)
      || (orders as any[])[0];
    let masterId: string | null = anchor.master_bill_id
      || (orders as any[]).map((o) => o.master_bill_id).find(Boolean)
      || null;
    let master: any = null;
    if (masterId) {
      const { data } = await supabase.from('pos_master_bills').select('*').eq('id', masterId).maybeSingle();
      master = data;
    }
    if (!master) {
      const anchorOutlet = Array.isArray(anchor.outlet) ? anchor.outlet[0] : anchor.outlet;
      // A combined bill gets the SAME kind of mixed letter+number short code a
      // normal POS order carries (e.g. A7K3M9), so the cashier looks it up
      // exactly like any POS bill — not a KYO-000245 style sequential number.
      const masterNumber = await generateMasterBillShortCode(
        branchId, String(anchor.outlet_id || ''), String(req.user.id)
      );
      const { data: created, error: cErr } = await supabase.from('pos_master_bills').insert({
        master_bill_number: masterNumber,
        branch_id: branchId,
        origin_outlet_id: anchor.outlet_id,
        origin_outlet_name: anchorOutlet?.name || null,
        table_number: nullableText(anchor.table_number) || nullableText(req.body.table_number),
        customer_name: nullableText(anchor.customer_name) || nullableText(req.body.label) || 'Walk-in',
        opening_waiter_id: anchor.waiter_id,
        opening_waiter_name: anchor.waiter_name,
        status: 'open'
      }).select('*').single();
      if (cErr || !created) throw cErr || new AppError('Failed to open master bill', 500);
      master = created;
      masterId = created.id;
    }

    const { error: updErr } = await supabase
      .from('pos_shift_orders')
      .update({ master_bill_id: masterId, sub_bill_status: 'included', updated_at: new Date().toISOString() })
      .in('id', allIds);
    if (updErr) throw updErr;

    await recomputeMasterBillTotals(masterId!);
    const view = await loadMasterBillView(masterId!);
    res.json({ success: true, data: view });
  } catch (error) {
    next(error);
  }
};

// POST /pos/bills/:customerBillId/unlink-order — remove an order from a bill.
// body: { order_id }
export const unlinkOrderFromBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { masterBillId } = req.params;
    const orderId = nullableText(req.body.order_id);
    if (!orderId) throw new AppError('order_id is required', 400);

    const { data: order, error } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('id', orderId)
      .eq('master_bill_id', masterBillId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new AppError('Order is not part of this bill', 404);
    ensureBranchAccess(req, (order as any).branch_id);
    if (shouldScopeOrdersToOwner(req) && !orderIsOwnedBy(order as any, String(req.user.id))) {
      throw new AppError('You can only edit your own bills', 403);
    }
    if (['paid', 'credit_bill', 'voided'].includes(String((order as any).payment_status))) {
      throw new AppError('Cannot remove an order that is already settled', 409);
    }

    await supabase
      .from('pos_shift_orders')
      .update({ master_bill_id: null, sub_bill_status: 'open', updated_at: new Date().toISOString() })
      .eq('id', orderId);
    await recomputeMasterBillTotals(masterBillId);
    const view = await loadMasterBillView(masterBillId);
    res.json({ success: true, data: view });
  } catch (error) {
    next(error);
  }
};

// POST /pos/bills/:masterBillId/pay — the origin/settlement cashier collects the
// WHOLE bill in one tender. Each member order is settled against its own outlet
// shift (so revenue + stock attribute to the correct outlet), the master bill is
// closed, and each per-outlet sub-bill is marked 'settled' pending that outlet
// cashier's confirmation (the origin outlet is auto-confirmed — collected
// locally). body: { payment_method, reference? }.
// Core settlement for a master (combined) bill — shared by the POS consolidated
// pay endpoint AND the main cashier station (lookup + pay). Settles every member
// order against its OWN outlet shift (per-outlet revenue + stock), closes the
// master bill, and marks each outlet sub-bill settled (origin auto-confirmed).
// Throws AppError on any gate. Callers do their own role/branch checks first.
export const settleMasterBillCore = async (
  master: Record<string, any>,
  opts: { method: string; userId: string; cashierName: string | null }
): Promise<{ totalSettled: number; view: Record<string, any> | null; method: PaymentMethod }> => {
  const masterBillId = String(master.id);
  const method = normalizePaymentMethod(opts.method);
  if (!method) throw new AppError('Unsupported payment method', 400);
  if (method === 'credit_bill') {
    throw new AppError('Credit-bill settlement must be done per order, not on a consolidated bill.', 400);
  }

  const { data: memberRows, error } = await supabase
    .from('pos_shift_orders')
    .select('*')
    .eq('master_bill_id', masterBillId)
    .not('status', 'eq', 'cancelled');
  if (error) throw error;
  const members = (memberRows || []) as Array<Record<string, any>>;
  const unsettled = members.filter((o) => !['paid', 'credit_bill', 'voided'].includes(String(o.payment_status)));
  if (unsettled.length === 0) throw new AppError('This bill is already settled', 409);

  // Every member's outlet shift must be open to accept payment + post stock.
  const shiftIds = Array.from(new Set(unsettled.map((o) => String(o.shift_id))));
  const { data: shiftRows, error: shiftErr } = await supabase
    .from('pos_outlet_shifts')
    .select('id, status, branch_id, outlet_id, outlet:pos_outlets(name, outlet_type)')
    .in('id', shiftIds);
  if (shiftErr) throw shiftErr;
  const shiftById = new Map((shiftRows || []).map((s: any) => [String(s.id), s]));
  for (const o of unsettled) {
    const shift = shiftById.get(String(o.shift_id));
    if (!shift) throw new AppError('An outlet shift for this bill could not be found', 404);
    if (String(shift.status) !== 'open') {
      const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
      throw new AppError(`The ${outlet?.name || 'outlet'} shift is closed — reopen it or settle that item separately before settling the combined bill.`, 400);
    }
  }

  let totalSettled = 0;
  for (const order of unsettled) {
    const shift = shiftById.get(String(order.shift_id));
    const balance = Math.max(0, numberValue(order.balance_amount) || numberValue(order.total_amount) - numberValue(order.amount_paid));
    await settleOrderBalance({
      order,
      shift,
      method,
      amount: balance,
      receivedBy: opts.userId,
      reference: master.master_bill_number || `BILL-${masterBillId.slice(0, 8)}`
    });
    await supabase.from('pos_shift_orders').update({ sub_bill_status: 'settled' }).eq('id', order.id);
    totalSettled += balance;
  }

  // Close the master bill + stamp the settlement (origin) cashier.
  await recomputeMasterBillTotals(masterBillId);
  const now = new Date().toISOString();
  await supabase.from('pos_master_bills').update({
    status: 'closed',
    settlement_cashier_id: opts.userId,
    settlement_cashier_name: opts.cashierName,
    payment_method: method,
    paid_at: now,
    closed_at: now,
    updated_at: now
  }).eq('id', masterBillId);

  // Each outlet sub-bill is 'settled' pending that outlet cashier's
  // confirmation; the origin outlet is auto-confirmed (collected locally).
  await supabase.from('pos_master_bill_settlements').update({
    status: 'settled', collecting_cashier_id: opts.userId, payment_method: method, updated_at: now
  }).eq('master_bill_id', masterBillId).neq('status', 'cashier_confirmed');
  await supabase.from('pos_master_bill_settlements').update({
    status: 'cashier_confirmed', confirmed_by: opts.userId, confirmed_at: now
  }).eq('master_bill_id', masterBillId).eq('is_origin', true);

  const view = await loadMasterBillView(masterBillId);
  return { totalSettled, view, method };
};

// Resolve a master (combined) bill for cashier-station lookup from: the full
// master_bill_number (e.g. KYO-000245), its last-N-char/-digit suffix, or ANY
// member order's order_number/short_code (full or suffix). Scoped to the branch
// and to bills not already closed. Suffix needs >= 3 chars to stay unambiguous.
export const resolveMasterBillByCode = async (
  rawTerm: string,
  branchId: number | null
): Promise<Record<string, any> | null> => {
  const term = String(rawTerm || '').trim().toUpperCase();
  if (!term) return null;
  const openStatuses = ['open', 'bill_requested', 'payment_received'];
  const isSuffix = term.length >= 3 && term.length <= 10;
  const normalizedUuid = isValidUUID(term) ? term : null;

  // 0) Direct UUID lookup — cashier unpaid-queue rows keep the real master-bill
  // id for downstream payment posting, so allow the raw master id to resolve
  // back to the consolidated customer bill as well.
  if (normalizedUuid) {
    let q = supabase.from('pos_master_bills').select('*').eq('id', normalizedUuid);
    if (branchId) q = q.eq('branch_id', branchId);
    const { data } = await q.maybeSingle();
    if (data) return data as Record<string, any>;
  }

  // 1) Exact master bill number.
  {
    let q = supabase.from('pos_master_bills').select('*').eq('master_bill_number', term);
    if (branchId) q = q.eq('branch_id', branchId);
    const { data } = await q.maybeSingle();
    if (data) return data as Record<string, any>;
  }
  // 2) Suffix of the master bill number (e.g. "245" -> KYO-000245).
  if (isSuffix) {
    let q = supabase.from('pos_master_bills').select('*')
      .ilike('master_bill_number', `%${term}`)
      .in('status', openStatuses)
      .order('created_at', { ascending: false }).limit(1);
    if (branchId) q = q.eq('branch_id', branchId);
    const { data } = await q;
    if (data && data.length) return data[0] as Record<string, any>;
  }
  // 3) A member order's code (exact or suffix) -> its master bill.
  {
    const filter = isSuffix
      ? `order_number.eq.${term},short_code.eq.${term},order_number.ilike.%${term},short_code.ilike.%${term}`
      : `order_number.eq.${term},short_code.eq.${term}`;
    let q = supabase.from('pos_shift_orders').select('master_bill_id, created_at')
      .not('master_bill_id', 'is', null)
      .or(filter)
      .order('created_at', { ascending: false }).limit(1);
    if (branchId) q = q.eq('branch_id', branchId);
    const { data: ord } = await q;
    const mid = ord && ord.length ? (ord[0] as any).master_bill_id : null;
    if (mid) {
      let mq = supabase.from('pos_master_bills').select('*').eq('id', mid);
      if (branchId) mq = mq.eq('branch_id', branchId);
      const { data: m } = await mq.maybeSingle();
      if (m) return m as Record<string, any>;
    }
  }
  return null;
};

export const payConsolidatedBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    throw new AppError(
      'Combined customer bills must be cleared from Cashier Station so the cashier ledger and shift totals stay correct.',
      409
    );
  } catch (error) {
    next(error);
  }
};

export const getMyStaffCreditBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    // 1. Resolve staff profile & user details for logged-in user
    const { data: userRec } = await supabase
      .from('users')
      .select('id, first_name, last_name, display_name, email')
      .eq('id', userId)
      .maybeSingle();

    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('id, user_id, employee_number')
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    const staffId = staffProfile?.id || userId;
    const staffName = (userRec
      ? `${userRec.first_name || ''} ${userRec.last_name || ''}`.trim() || userRec.display_name
      : '') || '';

    // Collect ALL linked user & profile IDs for this staff member
    const staffIdsSet = new Set<string>([userId]);
    if (staffProfile?.id) staffIdsSet.add(staffProfile.id);
    if (staffProfile?.user_id) staffIdsSet.add(staffProfile.user_id);

    // Look up any duplicate/secondary user records for the same employee email
    if (userRec?.email) {
      const emailPrefix = userRec.email.split('@')[0];
      if (emailPrefix && emailPrefix.length > 3) {
        const { data: linkedUsers } = await supabase
          .from('users')
          .select('id')
          .ilike('email', `${emailPrefix}%`);
        for (const u of (linkedUsers || [])) {
          staffIdsSet.add(u.id);
        }
      }
    }
    const staffIds = Array.from(staffIdsSet);

    // 2. Query staff_credit_bills (Approved & valid credit bills)
    const staffIdFilter = staffIds.map(id => `staff_id.eq.${id}`).join(',');

    const { data: staffBills, error: staffErr } = await supabase
      .from('staff_credit_bills')
      .select('*')
      .or(staffIdFilter)
      .neq('status', 'rejected')
      .order('created_at', { ascending: false });

    if (staffErr) {
      logger.warn('staff_credit_bills query error in getMyStaffCreditBills:', staffErr.message);
    }

    // 3. Query credit_bills (Approved & valid credit bills)
    let cashierFilter = staffIds.map(id => `staff_id.eq.${id}`).join(',');
    if (staffName) {
      cashierFilter += `,customer_name.ilike.%${staffName}%`;
    }

    let cashierBills: any[] = [];
    try {
      const { data: cbData, error: cbErr } = await supabase
        .from('credit_bills')
        .select('*')
        .or(cashierFilter)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });
      if (!cbErr && cbData) cashierBills = cbData;
    } catch (_) {}

    // 4. Fetch credit-billed pos_shift_orders for this staff member
    const nameVariants = staffName
      ? [...new Set([staffName, staffName.toUpperCase(), staffName.toLowerCase()])]
      : [];

    let posOrders: any[] = [];
    try {
      const idFilters = staffIds.map(id => `waiter_id.eq.${id}`).join(',');
      const exactNameFilters = nameVariants.map(n => `waiter_name.eq.${n}`).join(',');
      const orFilter = [idFilters, exactNameFilters].filter(Boolean).join(',');

      const { data: ordersData } = await supabase
        .from('pos_shift_orders')
        .select('id, order_number, short_code, waiter_id, waiter_name, customer_name, total_amount, items, created_at, staff_credit_bill_id, payment_status')
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(500);
      if (ordersData) posOrders = ordersData;
    } catch (_) {}

    // Also fetch by source_pos_order_id if directly linked
    const directOrderIds = [
      ...(staffBills || []).map((b: any) => b.source_pos_order_id),
      ...(cashierBills || []).map((b: any) => b.source_pos_order_id),
    ].filter(Boolean);

    if (directOrderIds.length > 0) {
      try {
        const { data: directOrders } = await supabase
          .from('pos_shift_orders')
          .select('id, order_number, short_code, waiter_id, waiter_name, customer_name, total_amount, items, created_at, staff_credit_bill_id, payment_status')
          .in('id', directOrderIds);
        if (directOrders) {
          const existingIds = new Set(posOrders.map((o: any) => o.id));
          for (const o of directOrders) {
            if (!existingIds.has(o.id)) posOrders.push(o);
          }
        }
      } catch (_) {}
    }

    // Track which POS orders we've already assigned
    const usedOrderIds = new Set<string>();

    const resolveItems = (b: any, rawAmt: number, dateStr?: string, docNo?: string) => {
      const billAmt = Number(rawAmt || 0);
      const bTime = new Date(b.created_at || dateStr || Date.now()).getTime();

      // 1. Direct UUID match (source_pos_order_id stored on the bill)
      let matched = b.source_pos_order_id
        ? posOrders.find((o: any) => o.id === b.source_pos_order_id)
        : null;

      // 2. staff_credit_bill_id on the POS order points back to this bill
      if (!matched) {
        matched = posOrders.find((o: any) =>
          o.staff_credit_bill_id && o.staff_credit_bill_id === b.id
        ) ?? null;
      }

      // 3. Source document / order number match
      if (!matched && docNo && docNo !== 'pending') {
        matched = posOrders.find((o: any) =>
          o.order_number === docNo || o.short_code === docNo
        ) ?? null;
      }

      // 4. Bill number matches order number
      if (!matched && b.bill_number) {
        matched = posOrders.find((o: any) =>
          o.order_number === b.bill_number || o.short_code === b.bill_number
        ) ?? null;
      }

      // 5. Time & Amount Fuzzy Match: within ≤ 1 KES diff & within 48 hours
      if (!matched && billAmt > 0) {
        const maxTimeDiffMs = 48 * 3600 * 1000; // 48h tolerance to bridge UTC vs local date
        const candidates = posOrders
          .filter((o: any) => {
            if (usedOrderIds.has(o.id)) return false;
            const oTime = new Date(o.created_at || 0).getTime();
            const oAmt = Number(o.total_amount || 0);
            const amtDiff = Math.abs(oAmt - billAmt);
            const timeDiff = Math.abs(oTime - bTime);
            return amtDiff <= 1 && timeDiff <= maxTimeDiffMs;
          })
          .sort((a: any, b: any) => {
            const aTimeDiff = Math.abs(new Date(a.created_at).getTime() - bTime);
            const bTimeDiff = Math.abs(new Date(b.created_at).getTime() - bTime);
            const aAmtDiff = Math.abs(Number(a.total_amount) - billAmt);
            const bAmtDiff = Math.abs(Number(b.total_amount) - billAmt);
            if (aAmtDiff !== bAmtDiff) return aAmtDiff - bAmtDiff;
            return aTimeDiff - bTimeDiff;
          });
        matched = candidates[0] ?? null;
      }

      // 6. Loose Fuzzy Match: within 5% amount diff & within 48 hours
      if (!matched && billAmt > 0) {
        const tolerance = Math.max(5, billAmt * 0.05);
        const maxTimeDiffMs = 48 * 3600 * 1000;
        const candidates = posOrders
          .filter((o: any) => {
            if (usedOrderIds.has(o.id)) return false;
            const oTime = new Date(o.created_at || 0).getTime();
            const oAmt = Number(o.total_amount || 0);
            const amtDiff = Math.abs(oAmt - billAmt);
            const timeDiff = Math.abs(oTime - bTime);
            return amtDiff <= tolerance && timeDiff <= maxTimeDiffMs;
          })
          .sort((a: any, b: any) => {
            const aTimeDiff = Math.abs(new Date(a.created_at).getTime() - bTime);
            const bTimeDiff = Math.abs(new Date(b.created_at).getTime() - bTime);
            const aAmtDiff = Math.abs(Number(a.total_amount) - billAmt);
            const bAmtDiff = Math.abs(Number(b.total_amount) - billAmt);
            if (aAmtDiff !== bAmtDiff) return aAmtDiff - bAmtDiff;
            return aTimeDiff - bTimeDiff;
          });
        matched = candidates[0] ?? null;
      }

      if (matched && Array.isArray(matched.items) && matched.items.length > 0) {
        usedOrderIds.add(matched.id);
        return matched.items.map((i: any) => ({
          name: i.name || i.item_name || i.title || 'Item',
          quantity: Number(i.quantity || i.qty || 1),
          unit_price: Number(i.unit_price || i.price || 0),
          line_total: Number(i.line_total || i.total || (Number(i.quantity || 1) * Number(i.unit_price || 0))),
          category: i.category || i.item_group || '',
          outlet_name: i.outlet_name || '',
        }));
      }

      // Fallback: description-only item
      return [
        {
          name: b.description || b.notes || 'Staff Credit Tab Charge',
          quantity: 1,
          unit_price: billAmt,
          line_total: billAmt,
          category: '',
          outlet_name: '',
        },
      ];
    };

    // 5. Normalize & combine (Credited bills only)
    const normalizedStaff = (staffBills || []).map((b: any) => {
      const amt = Number(b.amount || 0);
      const paid = Number(b.paid_amount || b.amount_paid || 0);
      const bal = b.balance != null ? Number(b.balance) : Math.max(0, amt - paid);
      return {
        id: b.id,
        bill_number: b.bill_number || `CRD-${b.id.substring(0, 8)}`,
        bill_date: b.bill_date || b.created_at?.split('T')[0],
        created_at: b.created_at,
        description: b.description || 'Staff Credit Bill',
        amount: amt,
        paid_amount: paid,
        balance: bal,
        status: b.status || 'open',
        approval_status: b.approval_status || 'approved',
        source: 'staff_credit_bills',
        items: resolveItems(b, amt, b.bill_date || b.created_at),
      };
    });

    const normalizedCashier = (cashierBills || []).map((b: any) => {
      const amt = Number(b.total_amount || b.amount || 0);
      const paid = Number(b.amount_paid || b.paid_amount || 0);
      const bal = b.balance_due != null ? Number(b.balance_due) : Math.max(0, amt - paid);
      return {
        id: b.id,
        bill_number: b.bill_number || `CRD-${b.id.substring(0, 8)}`,
        bill_date: b.bill_date || b.credit_date || b.created_at?.split('T')[0],
        created_at: b.created_at,
        description: b.notes || b.description || `Credit Bill (${b.customer_name || 'Staff'})`,
        amount: amt,
        paid_amount: paid,
        balance: bal,
        status: b.status || 'open',
        approval_status: b.approval_status || 'approved',
        source: 'credit_bills',
        items: resolveItems(b, amt, b.bill_date || b.credit_date || b.created_at, b.source_document_number),
      };
    });

    // Combine and deduplicate by bill_number / id
    const map = new Map<string, any>();
    for (const item of [...normalizedStaff, ...normalizedCashier]) {
      const key = item.bill_number || item.id;
      if (!map.has(key)) map.set(key, item);
    }

    const allBills = Array.from(map.values()).sort((a, b) =>
      new Date(b.created_at || b.bill_date).getTime() - new Date(a.created_at || a.bill_date).getTime()
    );

    const outstandingBalance = allBills.reduce((sum, b) => sum + (b.balance > 0 ? b.balance : 0), 0);
    const totalCredited = allBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPaid = allBills.reduce((sum, b) => sum + b.paid_amount, 0);

    res.json({
      success: true,
      data: {
        staff_name: staffName,
        outstanding_balance: outstandingBalance,
        total_credited: totalCredited,
        total_paid: totalPaid,
        count: allBills.length,
        bills: allBills,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Cross-outlet settlement confirmation (cashier) ──────────────────────────
// After the origin cashier settles a master bill, every OTHER outlet's sub-bill
// is 'settled' — the money was collected for them by the origin cashier. Each
// outlet cashier confirms (or disputes) their allocated amount before closing
// their shift. They cannot change the amount, only confirm / dispute.

// The POS outlet ids the current cashier is responsible for (role station types
// in their branch + any explicit assignments).
const resolveCashierOutletIds = async (req: Request): Promise<string[]> => {
  const branchId = branchIdFor(req);
  const role = roleFor(req);
  const ids = new Set<string>();
  const assigned = await loadAssignedPosOutlets(supabase, req.user?.id);
  for (const id of assignedOutletIds(assigned)) ids.add(id);
  const types = stationTypesForCashierRole(role, req.user?.branch_id);
  if (branchId && types.length) {
    const { data } = await supabase
      .from('pos_outlets').select('id').eq('branch_id', branchId).in('outlet_type', types);
    for (const o of (data || [])) ids.add(String(o.id));
  }
  // Also cover any outlet where this cashier has an open POS shift right now.
  const { data: shifts } = await supabase
    .from('pos_outlet_shifts').select('outlet_id').eq('cashier_id', String(req.user?.id || '')).eq('status', 'open');
  for (const s of (shifts || [])) if ((s as any).outlet_id) ids.add(String((s as any).outlet_id));
  return Array.from(ids);
};

// Count of cross-outlet settlements still awaiting THIS cashier's confirmation
// for the given outlets (used by the shift-close gate).
export const countUnconfirmedCrossOutletSettlements = async (
  branchId: number,
  outletIds: string[]
): Promise<number> => {
  if (!outletIds.length) return 0;
  const { count } = await supabase
    .from('pos_master_bill_settlements')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .in('outlet_id', outletIds)
    .eq('is_origin', false)
    .eq('status', 'settled');
  return count || 0;
};

const mapSettlementRow = (row: Record<string, any>): Record<string, any> => {
  const master = Array.isArray(row.master) ? row.master[0] : row.master;
  return {
    id: row.id,
    master_bill_id: row.master_bill_id,
    master_bill_number: master?.master_bill_number || null,
    customer_name: master?.customer_name || 'Walk-in',
    table_number: master?.table_number || null,
    origin_outlet_id: master?.origin_outlet_id || null,
    origin_outlet_name: master?.origin_outlet_name || null,
    settlement_cashier_id: master?.settlement_cashier_id || null,
    settlement_cashier_name: master?.settlement_cashier_name || null,
    outlet_id: row.outlet_id,
    outlet_name: row.outlet_name,
    amount: numberValue(row.amount),
    payment_method: row.payment_method || master?.payment_method || null,
    is_origin: row.is_origin === true,
    status: row.status,
    confirmed_at: row.confirmed_at || null,
    dispute_reason: row.dispute_reason || null,
    created_at: row.created_at
  };
};

// GET /pos/settlements/cross-outlet — sub-bills collected by ANOTHER outlet's
// cashier that this cashier must confirm (default) or the full history.
export const getCrossOutletSettlements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const branchId = branchIdFor(req);
    const outletIds = await resolveCashierOutletIds(req);
    if (outletIds.length === 0) { res.json({ success: true, data: [] }); return; }

    const statusFilter = String(req.query.status || 'pending').toLowerCase();
    let query = supabase
      .from('pos_master_bill_settlements')
      .select('*, master:pos_master_bills(master_bill_number, customer_name, table_number, origin_outlet_id, origin_outlet_name, settlement_cashier_id, settlement_cashier_name, payment_method)')
      .in('outlet_id', outletIds)
      .eq('is_origin', false)
      .order('created_at', { ascending: false })
      .limit(300);
    if (branchId) query = query.eq('branch_id', branchId);
    if (statusFilter === 'pending') query = query.eq('status', 'settled');
    else if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) throw error;

    const rows = [...(data || [])];
    // Also surface disputes on bills THIS cashier collected as the origin/
    // settlement cashier, so they can resolve them from the same screen.
    const { data: myMasters } = await supabase
      .from('pos_master_bills').select('id').eq('settlement_cashier_id', String(req.user.id));
    const myMasterIds = (myMasters || []).map((m: any) => m.id);
    if (myMasterIds.length) {
      const { data: disputed } = await supabase
        .from('pos_master_bill_settlements')
        .select('*, master:pos_master_bills(master_bill_number, customer_name, table_number, origin_outlet_id, origin_outlet_name, settlement_cashier_id, settlement_cashier_name, payment_method)')
        .in('master_bill_id', myMasterIds)
        .eq('status', 'disputed');
      const seen = new Set(rows.map((r: any) => String(r.id)));
      for (const d of (disputed || [])) {
        if (!seen.has(String((d as any).id))) { rows.push(d); seen.add(String((d as any).id)); }
      }
    }
    const userId = String(req.user.id);
    const mapped = rows.map((r: any) => {
      const m = mapSettlementRow(r);
      m.viewer_is_collector = String(m.settlement_cashier_id || '') === userId;
      return m;
    });
    res.json({ success: true, data: mapped });
  } catch (error) {
    next(error);
  }
};

// POST /pos/settlements/:settlementId/confirm — the outlet cashier confirms
// their allocated amount was collected on their behalf (amount is read-only).
export const confirmCrossOutletSettlement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const role = roleFor(req);
    if (!isCashierStationRole(role, req.user?.branch_id) && !SHIFT_MANAGER_ROLES.has(role) && !isGlobalUser(req)) {
      throw new AppError('Only the outlet cashier can confirm a settlement', 403);
    }
    const { settlementId } = req.params;
    const { data: row, error } = await supabase
      .from('pos_master_bill_settlements').select('*').eq('id', settlementId).maybeSingle();
    if (error) throw error;
    if (!row) throw new AppError('Settlement not found', 404);
    ensureBranchAccess(req, (row as any).branch_id);

    const outletIds = await resolveCashierOutletIds(req);
    if (!isGlobalUser(req) && !SHIFT_MANAGER_ROLES.has(role) && !outletIds.includes(String((row as any).outlet_id))) {
      throw new AppError('This settlement belongs to another outlet', 403);
    }
    if ((row as any).is_origin) throw new AppError('The origin outlet is confirmed automatically', 400);
    if (String((row as any).status) !== 'settled') {
      throw new AppError(`Cannot confirm a settlement that is ${(row as any).status}`, 409);
    }

    const { data: updated, error: updErr } = await supabase
      .from('pos_master_bill_settlements')
      .update({ status: 'cashier_confirmed', confirmed_by: req.user.id, confirmed_at: new Date().toISOString(), dispute_reason: null, updated_at: new Date().toISOString() })
      .eq('id', settlementId).select('*').single();
    if (updErr) throw updErr;
    res.json({ success: true, data: mapSettlementRow(updated) });
  } catch (error) {
    next(error);
  }
};

// POST /pos/settlements/:settlementId/dispute — raise a dispute (needs a reason).
export const disputeCrossOutletSettlement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const role = roleFor(req);
    if (!isCashierStationRole(role, req.user?.branch_id) && !SHIFT_MANAGER_ROLES.has(role) && !isGlobalUser(req)) {
      throw new AppError('Only the outlet cashier can dispute a settlement', 403);
    }
    const reason = nullableText(req.body.reason || req.body.dispute_reason);
    if (!reason) throw new AppError('A dispute reason is required', 400);
    const { settlementId } = req.params;
    const { data: row, error } = await supabase
      .from('pos_master_bill_settlements').select('*').eq('id', settlementId).maybeSingle();
    if (error) throw error;
    if (!row) throw new AppError('Settlement not found', 404);
    ensureBranchAccess(req, (row as any).branch_id);

    const outletIds = await resolveCashierOutletIds(req);
    if (!isGlobalUser(req) && !SHIFT_MANAGER_ROLES.has(role) && !outletIds.includes(String((row as any).outlet_id))) {
      throw new AppError('This settlement belongs to another outlet', 403);
    }
    if (String((row as any).status) === 'cashier_confirmed') {
      throw new AppError('Cannot dispute a settlement that is already confirmed', 409);
    }

    const { data: updated, error: updErr } = await supabase
      .from('pos_master_bill_settlements')
      .update({ status: 'disputed', dispute_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', settlementId).select('*, master:pos_master_bills(settlement_cashier_id, master_bill_number)').single();
    if (updErr) throw updErr;

    // Flag the collecting (origin) cashier so the dispute gets resolved.
    const master = Array.isArray((updated as any).master) ? (updated as any).master[0] : (updated as any).master;
    if (master?.settlement_cashier_id) {
      void notificationService.notifyUser(
        String(master.settlement_cashier_id),
        'Cross-outlet settlement disputed',
        `${(updated as any).outlet_name || 'An outlet'} disputed their KES ${numberValue((updated as any).amount).toLocaleString('en-KE')} share of bill ${master.master_bill_number}: ${reason}`,
        { type: 'warning', category: 'pos_settlement', priority: 'high', metadata: { settlement_id: settlementId, branch_id: Number((row as any).branch_id) } }
      ).catch(() => {});
    }
    res.json({ success: true, data: mapSettlementRow(updated) });
  } catch (error) {
    next(error);
  }
};

// POST /pos/bills/:masterBillId/add-items — add items from ANOTHER outlet to an
// existing master bill. The new order is created in that outlet's OWN open shift
// (correct prep printing / stock / revenue) but tagged with this master_bill_id
// so it joins the same customer bill. body: { outlet_id, items:[...], order_type? }
export const addItemsToMasterBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { masterBillId } = req.params;
    const outletId = nullableText(req.body.outlet_id);
    const items = Array.isArray(req.body.items) ? req.body.items as Array<Record<string, any>> : [];
    if (!outletId) throw new AppError('outlet_id is required', 400);
    if (!items.length) throw new AppError('At least one item is required', 400);

    const { data: master } = await supabase.from('pos_master_bills').select('*').eq('id', masterBillId).maybeSingle();
    if (!master) throw new AppError('Master bill not found', 404);
    ensureBranchAccess(req, (master as any).branch_id);
    if (String((master as any).status) === 'closed') throw new AppError('This bill is already closed', 409);
    if (shouldScopeOrdersToOwner(req) && (master as any).opening_waiter_id
        && String((master as any).opening_waiter_id) !== String(req.user.id)) {
      throw new AppError('You can only add to your own bill', 403);
    }

    const { data: outlet } = await supabase.from('pos_outlets').select('*').eq('id', outletId).maybeSingle();
    if (!outlet) throw new AppError('Outlet not found', 404);
    if (Number((outlet as any).branch_id) !== Number((master as any).branch_id)) {
      throw new AppError('Outlet belongs to another branch', 400);
    }
    const { data: openShift } = await supabase
      .from('pos_outlet_shifts').select('*')
      .eq('outlet_id', outletId).eq('status', 'open')
      .order('opened_at', { ascending: false }).limit(1).maybeSingle();
    if (!openShift) {
      throw new AppError(`${(outlet as any).name || 'That outlet'} has no open shift — its cashier must open a shift before items can be added there.`, 400);
    }

    const normalizedItems = await normalizeOrderItems(outletId, items);
    await assertPosStockAvailable(Number((outlet as any).branch_id), outletId, normalizedItems);
    const totalAmount = normalizedItems.reduce((s, it) => s + numberValue(it.line_total), 0);
    const context = orderContextPatch(req.body, null, (outlet as any).outlet_type);
    const waiterId = (master as any).opening_waiter_id || req.user.id;
    const waiterName = (master as any).opening_waiter_name
      || `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || null;

    const { data: order, error } = await supabase.from('pos_shift_orders').insert({
      shift_id: (openShift as any).id,
      outlet_id: outletId,
      branch_id: (outlet as any).branch_id,
      source_type: 'manual',
      order_number: `POS-${Date.now()}`,
      customer_name: (master as any).customer_name || 'Walk-in',
      ...context,
      waiter_id: waiterId,
      waiter_name: waiterName,
      status: 'open',
      kitchen_status: 'pending',
      payment_status: 'unpaid',
      total_amount: totalAmount,
      amount_paid: 0,
      balance_amount: totalAmount,
      items: normalizedItems,
      master_bill_id: masterBillId,
      sub_bill_status: 'included',
      created_by: req.user.id
    }).select('*').single();
    if (error || !order) throw error || new AppError('Failed to add items', 500);

    await createBillVerificationCode({
      code: order.short_code,
      billRef: String(order.order_number || order.id),
      billType: billTypeForOutlet((outlet as any).outlet_type),
      branchId: Number((outlet as any).branch_id),
      outletId,
      amount: totalAmount,
      generatedBy: String(req.user.id),
      notes: 'Master bill cross-outlet add',
      metadata: { source_table: 'pos_shift_orders', source_id: order.id, master_bill_id: masterBillId }
    }).catch(() => {});
    await updateStockForItems((openShift as any).id, outletId, normalizedItems, 1);
    recordKitchenConsumption(normalizedItems, Number((outlet as any).branch_id), (openShift as any).id, order.id)
      .catch((e) => logger.warn('recordKitchenConsumption failed', e as any));
    await recomputeMasterBillTotals(masterBillId);

    const view = await loadMasterBillView(masterBillId);
    res.status(201).json({ success: true, data: view });
  } catch (error) {
    next(error);
  }
};

// POST /pos/bills/:masterBillId/transfer-waiter — reassign the bill (and its
// still-open member orders) to another waiter. body: { waiter_id, waiter_name? }
export const transferMasterBillWaiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { masterBillId } = req.params;
    const newWaiterId = nullableText(req.body.waiter_id);
    if (!newWaiterId) throw new AppError('waiter_id is required', 400);

    const { data: master } = await supabase.from('pos_master_bills').select('*').eq('id', masterBillId).maybeSingle();
    if (!master) throw new AppError('Master bill not found', 404);
    ensureBranchAccess(req, (master as any).branch_id);
    if (shouldScopeOrdersToOwner(req) && (master as any).opening_waiter_id
        && String((master as any).opening_waiter_id) !== String(req.user.id)) {
      throw new AppError('You can only transfer your own bill', 403);
    }
    const { data: newWaiter } = await supabase
      .from('users').select('id, first_name, last_name, branch_id').eq('id', newWaiterId).maybeSingle();
    if (!newWaiter) throw new AppError('Waiter not found', 404);
    if ((newWaiter as any).branch_id && Number((newWaiter as any).branch_id) !== Number((master as any).branch_id)) {
      throw new AppError('Waiter belongs to another branch', 400);
    }
    const newName = `${(newWaiter as any).first_name || ''} ${(newWaiter as any).last_name || ''}`.trim()
      || nullableText(req.body.waiter_name) || null;

    const now = new Date().toISOString();
    await supabase.from('pos_master_bills')
      .update({ opening_waiter_id: newWaiterId, opening_waiter_name: newName, updated_at: now })
      .eq('id', masterBillId);
    await supabase.from('pos_shift_orders')
      .update({ waiter_id: newWaiterId, waiter_name: newName, updated_at: now })
      .eq('master_bill_id', masterBillId)
      .not('payment_status', 'in', '(paid,credit_bill,voided)');

    const view = await loadMasterBillView(masterBillId);
    res.json({ success: true, data: view });
  } catch (error) {
    next(error);
  }
};

// POST /pos/bills/:masterBillId/move-table — change the bill's table. body: { table_number }
export const moveMasterBillTable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const { masterBillId } = req.params;
    const tableNumber = nullableText(req.body.table_number);

    const { data: master } = await supabase.from('pos_master_bills').select('*').eq('id', masterBillId).maybeSingle();
    if (!master) throw new AppError('Master bill not found', 404);
    ensureBranchAccess(req, (master as any).branch_id);
    if (shouldScopeOrdersToOwner(req) && (master as any).opening_waiter_id
        && String((master as any).opening_waiter_id) !== String(req.user.id)) {
      throw new AppError('You can only move your own bill', 403);
    }

    const now = new Date().toISOString();
    await supabase.from('pos_master_bills')
      .update({ table_number: tableNumber, updated_at: now }).eq('id', masterBillId);
    await supabase.from('pos_shift_orders')
      .update({ table_number: tableNumber, updated_at: now })
      .eq('master_bill_id', masterBillId)
      .not('payment_status', 'in', '(paid,credit_bill,voided)');

    const view = await loadMasterBillView(masterBillId);
    res.json({ success: true, data: view });
  } catch (error) {
    next(error);
  }
};

// POST /pos/settlements/:settlementId/resolve — the collecting (origin) cashier
// or a manager resolves a disputed sub-bill: 'confirm' (accept & confirm) or
// 'reopen' (send back to the outlet cashier to re-confirm). body: { resolution? }
export const resolveDisputedSettlement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const role = roleFor(req);
    if (!isCashierStationRole(role, req.user?.branch_id) && !SHIFT_MANAGER_ROLES.has(role) && !isGlobalUser(req)) {
      throw new AppError('Not permitted', 403);
    }
    const { settlementId } = req.params;
    const resolution = nullableText(req.body.resolution) === 'reopen' ? 'reopen' : 'confirm';

    const { data: row } = await supabase
      .from('pos_master_bill_settlements')
      .select('*, master:pos_master_bills(settlement_cashier_id)')
      .eq('id', settlementId).maybeSingle();
    if (!row) throw new AppError('Settlement not found', 404);
    ensureBranchAccess(req, (row as any).branch_id);
    if (String((row as any).status) !== 'disputed') throw new AppError('Only a disputed settlement can be resolved', 409);

    const master = Array.isArray((row as any).master) ? (row as any).master[0] : (row as any).master;
    const isCollector = String(master?.settlement_cashier_id || '') === String(req.user.id)
      || String((row as any).collecting_cashier_id || '') === String(req.user.id);
    if (!isCollector && !SHIFT_MANAGER_ROLES.has(role) && !isGlobalUser(req)) {
      throw new AppError('Only the collecting cashier or a manager can resolve this dispute', 403);
    }

    const nextStatus = resolution === 'reopen' ? 'settled' : 'cashier_confirmed';
    const { data: updated, error } = await supabase
      .from('pos_master_bill_settlements')
      .update({
        status: nextStatus,
        confirmed_by: nextStatus === 'cashier_confirmed' ? req.user.id : null,
        confirmed_at: nextStatus === 'cashier_confirmed' ? new Date().toISOString() : null,
        dispute_reason: nextStatus === 'settled' ? (row as any).dispute_reason : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', settlementId)
      .select('*, master:pos_master_bills(master_bill_number, customer_name, table_number, origin_outlet_id, origin_outlet_name, settlement_cashier_id, settlement_cashier_name, payment_method)')
      .single();
    if (error) throw error;
    res.json({ success: true, data: mapSettlementRow(updated) });
  } catch (error) {
    next(error);
  }
};

// POST /pos/settlements/:settlementId/accountant-resolve — Branch Accountant
// resolves a disputed master bill share using Option 1, 2, or 3.
export const accountantResolveDisputedSettlement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    const role = roleFor(req);
    if (!ACCOUNTANT_ROLES.has(role) && !SHIFT_MANAGER_ROLES.has(role) && !isGlobalUser(req)) {
      throw new AppError('Only the Branch Accountant or Manager can resolve disputed settlements', 403);
    }

    const { settlementId } = req.params;
    const { action, payment_method, additional_amount, reference, room_number, new_allocations, void_reason } = req.body || {};

    if (!['option1_collect_additional_payment', 'option2_reallocate_shares', 'option3_authorize_void_discount'].includes(action)) {
      throw new AppError('Action must be one of option1_collect_additional_payment, option2_reallocate_shares, option3_authorize_void_discount', 400);
    }

    const { data: row, error: fetchErr } = await supabase
      .from('pos_master_bill_settlements')
      .select('*, master:pos_master_bills(*)')
      .eq('id', settlementId)
      .maybeSingle();
    if (fetchErr || !row) throw new AppError('Settlement not found', 404);
    ensureBranchAccess(req, (row as any).branch_id);

    const master = Array.isArray((row as any).master) ? (row as any).master[0] : (row as any).master;
    const now = new Date().toISOString();
    let resolutionSummary = '';

    if (action === 'option1_collect_additional_payment') {
      const extraAmt = numberValue(additional_amount);
      if (extraAmt <= 0) throw new AppError('Additional amount must be greater than zero', 400);
      const method = normalizePaymentMethod(payment_method || 'cash');

      resolutionSummary = `Option 1: Collected additional KES ${extraAmt.toLocaleString('en-KE')} via ${method?.toUpperCase()} (Ref: ${reference || room_number || 'N/A'})`;

      await recordCashierTransactionSafe({
        branchId: Number((row as any).branch_id),
        cashierId: String(req.user.id),
        paymentAmount: extraAmt,
        payment_method: method,
        payment_reference: reference || room_number || null,
        revenueType: 'pos_master_bill_additional',
        referenceType: 'pos_master_bills',
        referenceId: String(master.id),
        sourceModule: 'pos',
        sourceDocumentType: 'pos_master_bills',
        sourceDocumentId: String(master.id),
        sourceDocumentNumber: String(master.master_bill_number || ''),
        billNumber: String(master.master_bill_number || ''),
        orderNumber: String(master.master_bill_number || ''),
        customerName: String(master.customer_name || 'Walk-in')
      });

      if (master?.id) {
        await supabase.from('pos_master_bills')
          .update({ amount_paid: numberValue(master.amount_paid) + extraAmt, updated_at: now })
          .eq('id', master.id);
      }

    } else if (action === 'option2_reallocate_shares') {
      if (!Array.isArray(new_allocations) || !new_allocations.length) {
        throw new AppError('new_allocations array is required for reallocating shares', 400);
      }
      resolutionSummary = `Option 2: Re-allocated settlement shares across outlets by Accountant ${req.user.first_name || ''}`;

      for (const alloc of new_allocations) {
        if (alloc.outlet_id && alloc.amount != null) {
          await supabase.from('pos_master_bill_settlements')
            .update({ amount: numberValue(alloc.amount), updated_at: now })
            .eq('master_bill_id', master.id)
            .eq('outlet_id', alloc.outlet_id);
        }
      }

    } else if (action === 'option3_authorize_void_discount') {
      const reasonText = nullableText(void_reason);
      if (!reasonText) throw new AppError('Void/discount reason is required for Option 3', 400);
      resolutionSummary = `Option 3: Authorized manager void/discount: ${reasonText}`;

      await supabase.from('pos_item_void_log').insert({
        branch_id: Number((row as any).branch_id),
        requested_by: (row as any).supplying_cashier_id || req.user.id,
        approved_by: req.user.id,
        status: 'approved',
        reason: `Disputed master bill ${master?.master_bill_number}: ${reasonText}`,
        created_at: now
      }).catch(() => {});
    }

    // Update settlement record to confirmed with resolution notes
    const { data: updated, error: updErr } = await supabase
      .from('pos_master_bill_settlements')
      .update({
        status: 'cashier_confirmed',
        confirmed_by: req.user.id,
        confirmed_at: now,
        dispute_reason: null,
        updated_at: now
      })
      .eq('id', settlementId)
      .select('*, master:pos_master_bills(*)')
      .single();
    if (updErr) throw updErr;

    // Audit Log entry into inventory_audit_logs for Cashier Logbook traceability
    await supabase.from('inventory_audit_logs').insert({
      branch_id: Number((row as any).branch_id),
      event_type: 'MASTER_BILL_DISPUTE_RESOLVED',
      entity_type: 'pos_master_bill_settlements',
      entity_id: settlementId,
      actor_id: req.user.id,
      notes: `Master Bill ${master?.master_bill_number} dispute resolved by Accountant. ${resolutionSummary}`,
      created_at: now
    }).catch(() => {});

    res.json({ success: true, message: 'Disputed settlement resolved successfully', data: mapSettlementRow(updated) });
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
    // Block close while any item-level void request on this shift is sitting
    // in the cashier's own queue ('kitchen_acknowledged') -- approving/
    // declining after close would mutate a bill that's already been swept
    // into the shift summary. Requests still at 'pending' haven't reached
    // the cashier yet (kitchen's queue, not theirs). Escalate to the branch
    // accountant so the backlog gets cleared rather than silently stalling.
    const { data: pendingItemVoids, error: pendingItemVoidsError } = await supabase
      .from('pos_item_void_requests')
      .select('id')
      .eq('shift_id', shiftId)
      .eq('status', 'kitchen_acknowledged');
    if (pendingItemVoidsError) throw pendingItemVoidsError;
    if (pendingItemVoids && pendingItemVoids.length > 0) {
      await notificationService.notifyRole(
        'branch_accountant',
        'Shift close blocked by pending item voids',
        `${pendingItemVoids.length} item void request(s) on this shift still need cashier acknowledgement or decline before it can close.`,
        {
          type: 'warning',
          category: 'pos_item_void_request',
          priority: 'high',
          branchId: shift.branch_id,
          metadata: { shift_id: shiftId, pending_request_ids: pendingItemVoids.map((row: Record<string, any>) => row.id) }
        }
      );
      throw new AppError(`Cannot close shift: ${pendingItemVoids.length} item void request(s) must be acknowledged or declined first.`, 400);
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

    // Block close until this outlet has confirmed every cross-outlet settlement
    // collected on its behalf by another (origin) cashier — cashier accountability.
    const pendingSettlements = await countUnconfirmedCrossOutletSettlements(
      Number(shift.branch_id), [String(shift.outlet_id)]
    );
    if (pendingSettlements > 0) {
      throw new AppError(`Cannot close shift: ${pendingSettlements} cross-outlet settlement(s) for this station still need your confirmation. Confirm them in Cross-Outlet Settlements first.`, 400);
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

// ── Cashier Void Management ─────────────────────────────────────────────────
// Void ownership moved entirely to the cashier station: the cashier searches
// for a bill directly (no waiting for a bartender/waiter "request void") and
// voids it immediately — whole bill or specific line items. This sits
// alongside (does not replace) the older request→cashier-ack→manager-approve
// pipeline above: it reuses the same tables (pos_void_requests,
// pos_item_void_requests, pos_item_void_log) and the same order-mutation
// logic, just collapsing the multi-stage approval into one cashier-initiated
// transaction, since the Branch Accountant's role here is a read-only
// post-hoc audit (see cashier_shift_void_audits), not a pre-execution gate.

export const CASHIER_VOID_REASON_CATEGORIES = [
  'customer_changed_order',
  'item_out_of_stock',
  'wrong_item_ordered',
  'duplicate_order',
  'customer_cancelled',
  'quality_issue',
  // 'broken' means physically broken/damaged — auto-sets returned_to_stock=false
  'broken',
  'manager_instruction',
  'billing_error',
  'other'
] as const;
const CASHIER_VOID_REASON_CATEGORY_SET = new Set<string>(CASHIER_VOID_REASON_CATEGORIES);

const canManageCashierVoids = (req: Request): boolean =>
  isCashierStationRole(roleFor(req), req.user?.branch_id) || REVIEW_ROLES.has(roleFor(req)) || isGlobalUser(req);

const ensureCashierShiftOpenForVoid = async (req: Request, branchId: number): Promise<void> => {
  if (isGlobalUser(req) || REVIEW_ROLES.has(roleFor(req))) return;
  const { data, error } = await supabase
    .from('cashier_shift_logs')
    .select('id')
    .eq('cashier_id', req.user!.id)
    .eq('branch_id', branchId)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError('Open a cashier shift before processing a void', 400);
};

const validateVoidReason = (reasonCategory: unknown, reason: unknown, note: unknown): { reasonCategory: string; reason: string } => {
  const category = String(reasonCategory || '').trim().toLowerCase();
  if (!CASHIER_VOID_REASON_CATEGORY_SET.has(category)) {
    throw new AppError(`Invalid reason_category. Must be one of: ${CASHIER_VOID_REASON_CATEGORIES.join(', ')}`, 400);
  }
  const noteText = String(note || '').trim();
  const reasonText = String(reason || '').trim() || noteText;
  if (category === 'other' && !noteText) {
    throw new AppError('A note is required when reason_category is "other"', 400);
  }
  if (!reasonText) {
    throw new AppError('A void reason is required', 400);
  }
  return { reasonCategory: category, reason: reasonText };
};

// Section 1: unified search across waiter/server name, bill shortcode, and
// order number — branch-scoped only (per spec: any cashier in the branch can
// void any outlet's bill, not just their own station's).
export const searchVoidableBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!canManageCashierVoids(req)) throw new AppError('Forbidden: cashier role required', 403);
    const branchId = branchIdFor(req);
    if (!branchId && !isGlobalUser(req)) {
      res.json({ success: true, data: [] });
      return;
    }
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ success: true, data: [] });
      return;
    }
    const like = `%${q.replace(/[%_]/g, '')}%`;

    let query = supabase
      .from('pos_shift_orders')
      .select('id, shift_id, outlet_id, order_number, short_code, customer_name, waiter_id, waiter_name, table_number, room_number, order_type, total_amount, payment_status, items, branch_id, created_at')
      .in('payment_status', ['unpaid', 'partial'])
      .or(`order_number.ilike.${like},short_code.ilike.${like},waiter_name.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(25);

    if (!isGlobalUser(req)) {
      query = query.eq('branch_id', branchId);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', Number(req.query.branch_id));
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const outletIds = [...new Set(rows.map((r: any) => r.outlet_id).filter(Boolean))];
    const { data: outlets } = outletIds.length
      ? await supabase.from('pos_outlets').select('id, name, outlet_type').in('id', outletIds)
      : { data: [] as any[] };
    const outletsById = new Map((outlets || []).map((o: any) => [o.id, o]));

    res.json({
      success: true,
      data: rows.map((row: any) => ({
        ...row,
        outlet_name: outletsById.get(row.outlet_id)?.name || null,
        outlet_type: outletsById.get(row.outlet_id)?.outlet_type || null,
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Section 2A: void the entire bill, immediately, no separate approval stage.
export const cashierVoidWholeBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!canManageCashierVoids(req)) throw new AppError('Forbidden: cashier role required', 403);
    const orderId = String(req.body.order_id || '');
    if (!orderId) throw new AppError('order_id is required', 400);
    const { reasonCategory, reason } = validateVoidReason(req.body.reason_category, req.body.reason, req.body.note);

    const { data: order, error: orderErr } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) throw new AppError('Bill not found', 404);
    ensureBranchAccess(req, order.branch_id);
    ensureEditableOrder(order, 'void');
    await ensureCashierShiftOpenForVoid(req, Number(order.branch_id));

    const now = new Date().toISOString();
    const originalTotal = numberValue(order.total_amount);
    const cashierId = req.user!.id;

    const { data: voidRequest, error: insertErr } = await supabase
      .from('pos_void_requests')
      .insert({
        shift_id: order.shift_id,
        outlet_id: order.outlet_id,
        order_id: order.id,
        order_number: order.order_number,
        branch_id: order.branch_id,
        requested_by: cashierId,
        reason,
        reason_category: reasonCategory,
        returned_to_stock: reasonCategory !== 'broken',
        status: 'approved',
        reviewed_by: cashierId,
        reviewed_at: now,
        updated_at: now
      })
      .select('*')
      .single();
    if (insertErr) throw insertErr;

    const voidReturnedToStock = reasonCategory !== 'broken';

    await updateStockForItems(order.shift_id, order.outlet_id, Array.isArray(order.items) ? order.items : [], -1, voidReturnedToStock);
    await reverseKitchenConsumptionForOrder(orderId).catch((consumptionError) =>
      logger.warn('cashierVoidWholeBill: reverseKitchenConsumptionForOrder failed', consumptionError as any));
    if (order.inventory_posted_at && !order.inventory_reversed_at) {
      await postPosInventorySale({
        branchId: Number(order.branch_id),
        outletId: order.outlet_id,
        shiftId: order.shift_id,
        orderId: order.id,
        items: Array.isArray(order.items) ? order.items : [],
        actorId: cashierId,
        reverse: true
      });
    }

    const voidedItems = Array.isArray(order.items)
      ? order.items.map((item: any) => ({ ...item, kitchen_status: 'voided' }))
      : order.items;
    const { data: updatedOrder, error: voidOrderErr } = await supabase
      .from('pos_shift_orders')
      .update({
        status: 'voided',
        payment_status: 'voided',
        kitchen_status: 'voided',
        items: voidedItems,
        total_amount: 0,
        balance_amount: 0,
        void_request_status: 'approved',
        voided_at: now,
        voided_by: cashierId,
        void_reason: reason,
        inventory_reversed_at: order.inventory_posted_at ? now : order.inventory_reversed_at || null,
        inventory_reversed_by: order.inventory_posted_at ? cashierId : order.inventory_reversed_by || null,
        updated_at: now
      })
      .eq('id', orderId)
      .select('*')
      .single();
    if (voidOrderErr) throw voidOrderErr;

    if (numberValue(order.amount_paid) > 0) {
      const { error: reverseError } = await supabase.rpc('reverse_cashier_shift_for_order', { p_order_id: orderId });
      if (reverseError) {
        logger.warn('cashierVoidWholeBill: failed to reverse shift totals for voided order', {
          orderId, amountPaid: order.amount_paid, error: reverseError.message
        });
      }
    }

    // Structured detail for the Branch Accountant deep-drill view — written here
    // (at void time) because pos_shift_orders.total_amount gets zeroed above, so
    // the original total would otherwise be lost. void_bills_audit already
    // exists as a generic (void_id, action, actor_id, details jsonb) log; no new
    // column/table needed for this.
    await supabase.from('void_bills_audit').insert({
      void_id: voidRequest.id,
      action: 'cashier_void',
      actor_id: cashierId,
      details: {
        order_number: order.order_number,
        short_code: order.short_code,
        waiter_id: order.waiter_id,
        waiter_name: order.waiter_name,
        outlet_id: order.outlet_id,
        branch_id: order.branch_id,
        original_total: originalTotal,
        revised_total: 0,
        reason_category: reasonCategory,
        reason
      }
    });

    await Promise.allSettled([
      notificationService.notifyRole(
        'branch_accountant',
        'Bill voided by cashier',
        `${order.order_number || order.short_code || 'A bill'} (KES ${originalTotal.toFixed(2)}) was voided by the cashier.`,
        { type: 'warning', category: 'cashier_void', priority: 'medium', branchId: order.branch_id, metadata: { order_id: orderId, void_id: voidRequest.id } }
      ),
      order.waiter_id && notificationService.notifyUser(
        order.waiter_id,
        'Bill voided',
        `Bill ${order.order_number || order.short_code || ''} was voided by the cashier. Updated bill is ready for reprint.`,
        { type: 'info', category: 'cashier_void', priority: 'medium', metadata: { order_id: orderId } }
      ),
    ]);

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
};

// Section 2B: void specific line item(s) on a bill, immediately. Each item
// gets its own pos_item_void_requests + pos_item_void_log row (matching the
// existing schema/shape the Branch Accountant void-approvals screen and
// PowerSync sync streams already read), just collapsed into one cashier
// action instead of cashier-ack + manager-approve as two separate steps.
export const cashierVoidLineItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertUser(req);
    if (!canManageCashierVoids(req)) throw new AppError('Forbidden: cashier role required', 403);
    const orderId = String(req.body.order_id || '');
    const items: Array<{ item_index: number; qty_to_void?: number }> = Array.isArray(req.body.items) ? req.body.items : [];
    if (!orderId || items.length === 0) throw new AppError('order_id and at least one item are required', 400);
    const { reasonCategory, reason } = validateVoidReason(req.body.reason_category, req.body.reason, req.body.note);

    const { data: order, error: orderErr } = await supabase
      .from('pos_shift_orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) throw new AppError('Bill not found', 404);
    ensureBranchAccess(req, order.branch_id);
    ensureEditableOrder(order, 'void');
    await ensureCashierShiftOpenForVoid(req, Number(order.branch_id));

    const cashierId = req.user!.id;
    const now = new Date().toISOString();
    const orderItems: Array<Record<string, any>> = Array.isArray(order.items) ? order.items : [];
    let updatedOrder: Record<string, any> | null = null;

    for (const target of items) {
      const itemIndex = Number(target.item_index);
      const item = orderItems[itemIndex];
      if (!item) throw new AppError(`Item at index ${itemIndex} no longer exists on this bill`, 404);
      const { activeQty } = activeQtyForItem(item);
      const qtyToVoid = numberValue(target.qty_to_void ?? activeQty);
      if (qtyToVoid <= 0 || qtyToVoid > activeQty) {
        throw new AppError(`Invalid qty_to_void for item at index ${itemIndex}`, 400);
      }

      // Inserted straight at 'kitchen_acknowledged' (not 'pending') with the
      // cashier recorded as the kitchen actor too — this tool is the cashier
      // voiding directly with no waiter request and no separate kitchen
      // step, so it synthetically clears the kitchen-acknowledgment gate
      // that cashier_acknowledge_item_void now requires (added for the
      // waiter -> kitchen -> cashier -> accountant chain). Without this the
      // RPC call below throws "already processed" and the bill total never
      // gets reduced.
      const { data: requestRow, error: reqErr } = await supabase
        .from('pos_item_void_requests')
        .insert({
          shift_id: order.shift_id,
          outlet_id: order.outlet_id,
          order_id: order.id,
          order_number: order.order_number,
          branch_id: order.branch_id,
          item_index: itemIndex,
          item_name: item.name || item.item_name || 'Item',
          unit_price: numberValue(item.unit_price ?? item.price),
          qty_before_void: activeQty,
          qty_to_void: qtyToVoid,
          reason,
          reason_category: reasonCategory,
          requested_by: cashierId,
          status: 'kitchen_acknowledged',
          kitchen_id: cashierId,
          kitchen_acknowledged_at: now,
          kitchen_action: 'acknowledged'
        })
        .select('*')
        .single();
      if (reqErr) throw reqErr;

      // Stage 1 (financial void): same RPC the cashier-acknowledge flow uses,
      // so the math is identical whether the void started as a waiter request
      // or, as here, directly from the cashier.
      const { data: rpcOrder, error: rpcError } = await supabase.rpc('cashier_acknowledge_item_void', {
        p_request_id: requestRow.id,
        p_actioned_by: cashierId
      });
      if (rpcError) throw rpcError;

      await reverseKitchenConsumptionForOrder(orderId, { itemIndex, qtyToReverse: qtyToVoid }).catch((consumptionError) =>
        logger.warn('cashierVoidLineItems: reverseKitchenConsumptionForOrder failed', consumptionError as any));

      // Stage 2 (compliance sign-off + audit log): applied immediately by the
      // same cashier — no separate manager wait in this flow.
      const { data: orderAfterAck, error: orderAfterAckErr } = await supabase
        .from('pos_shift_orders')
        .select('id, items, outlet_id, short_code, amount_paid')
        .eq('id', orderId)
        .single();
      if (orderAfterAckErr || !orderAfterAck) throw orderAfterAckErr || new AppError('Order not found', 404);

      const itemsAfterAck = Array.isArray(orderAfterAck.items) ? [...orderAfterAck.items] as Array<Record<string, any>> : [];
      const ackedItem = itemsAfterAck[itemIndex] || {};
      itemsAfterAck[itemIndex] = { ...ackedItem, void_pending_approval: false };
      const revisedTotal = activeOrderItemsTotal(itemsAfterAck);
      const revisedBalance = Math.max(revisedTotal - numberValue(orderAfterAck.amount_paid), 0);

      const { data: finalOrder, error: finalOrderErr } = await supabase
        .from('pos_shift_orders')
        .update({
          items: itemsAfterAck,
          total_amount: revisedTotal,
          balance_amount: revisedBalance,
          bill_reprint_count: 0,
          updated_at: now
        })
        .eq('id', orderId)
        .select('*')
        .single();
      if (finalOrderErr) throw finalOrderErr;
      updatedOrder = finalOrder;

      const { data: outletRow } = await supabase
        .from('pos_outlets')
        .select('outlet_type')
        .eq('id', orderAfterAck.outlet_id)
        .maybeSingle();

      const qtyAfterVoid = numberValue(ackedItem.active_qty);
      await supabase.from('pos_item_void_log').insert({
        void_request_id: requestRow.id,
        shift_id: order.shift_id,
        order_id: order.id,
        item_index: itemIndex,
        item_name: requestRow.item_name,
        unit_price: requestRow.unit_price,
        qty_before_void: activeQty,
        qty_voided: qtyToVoid,
        qty_after_void: qtyAfterVoid,
        amount_voided: qtyToVoid * numberValue(requestRow.unit_price),
        authorized_by: cashierId,
        requested_by: cashierId,
        void_reason: reason,
        reason_category: reasonCategory,
        returned_to_stock: reasonCategory !== 'broken',
        branch_id: order.branch_id,
        outlet_type: outletRow?.outlet_type || null,
        bill_code: orderAfterAck.short_code || null,
        voided_at: now
      });

      await supabase
        .from('pos_item_void_requests')
        .update({ status: 'approved', actioned_by: cashierId, actioned_at: now, manager_id: cashierId, manager_reviewed_at: now, updated_at: now })
        .eq('id', requestRow.id);

      // Re-read for the next loop iteration so item_index lookups stay accurate.
      orderItems.splice(0, orderItems.length, ...itemsAfterAck);
    }

    if (order.waiter_id) {
      await notificationService.notifyUser(
        order.waiter_id,
        'Item(s) voided',
        `${items.length} item(s) voided on bill ${order.order_number || order.short_code || ''} by the cashier. Updated bill is ready for reprint.`,
        { type: 'info', category: 'cashier_void', priority: 'medium', metadata: { order_id: orderId } }
      );
    }

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
};
