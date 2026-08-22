import express from 'express';
import { supabase } from '../config/supabase';
import {
  getMenuCategories,
  createCategory,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleItemAvailability,
  createOrder,
  updateOrderStatus,
  getOrder,
  getOrders,
  addItemsToOrder,
  getInventoryItems,
  updateInventoryStock,
  createRoomServiceOrder,
  getRoomServiceOrders,
  updateRoomServiceOrderStatus,
  uploadMenuItemImage,
  deleteMenuItemImage,
  getDailySales
} from '../controllers/restaurant.controller';
import {
  getWastageRecords,
  createWastageRecord,
  getWastageSummary,
  getWastageItems,
  updateWastageRecord,
  deleteWastageRecord
} from '../controllers/restaurant/wastage.controller';
import { protect, authorize } from '../middleware/auth';
import { withCache } from '../middleware/cacheMiddleware';
import { optionalIdempotency } from '../middleware/idempotency';
import { UserRole } from '../models/User';
import { CacheKeys, CACHE_TTL } from '../services/cacheService';
import notificationService from '../services/notification.service';

// Import new sub-routes
import tableRoutes from './restaurant.table.routes';
import reservationRoutes from './restaurant.reservation.routes';

const router = express.Router();

const resolveMenuBranchId = (req: express.Request): number => {
  const requested = Number(req.query.branch_id);
  if (Number.isFinite(requested) && requested > 0) return requested;

  const userBranch = Number((req.user as any)?.branch_id ?? (req.user as any)?.branchId);
  if (Number.isFinite(userBranch) && userBranch > 0) return userBranch;

  return 0;
};

const resolveMenuFilterSignature = (req: express.Request): string =>
  [
    `category=${String(req.query.category || 'all').trim().toLowerCase()}`,
    `available=${String(req.query.available || 'all').trim().toLowerCase()}`,
    `vegetarian=${String(req.query.vegetarian || 'all').trim().toLowerCase()}`,
  ].join('|');

const resolveKitchenScope = (req: express.Request): KitchenOutletScope =>
  normalizeKitchenOutletScope(req.query.outlet_scope);

const kitchenCacheBranchId = (req: express.Request): number =>
  resolveKitchenBranchId(req) ?? 0;

const kitchenCacheLimit = (req: express.Request): number =>
  Math.min(parseInt(req.query.limit as string) || 100, 250);

const kitchenCacheTimeline = (req: express.Request): string =>
  String(req.query.timeline || 'shift').toLowerCase();

const normalizeKitchenStatus = (value: any): string => {
  const status = String(value || 'pending').toLowerCase();
  return ['pending', 'confirmed'].includes(status) ? 'pending' : status;
};

type KitchenOutletScope = 'restaurant' | 'choma_zone';

const normalizeKitchenOutletScope = (value: any): KitchenOutletScope => {
  return String(value || '').trim().toLowerCase() === 'choma_zone'
    ? 'choma_zone'
    : 'restaurant';
};

const shouldIncludeRestaurantOrders = (scope: KitchenOutletScope): boolean =>
  scope === 'restaurant';

const matchesKitchenOutletScope = (
  outletType: unknown,
  scope: KitchenOutletScope,
): boolean => {
  const type = String(outletType || '').trim().toLowerCase();
  if (scope === 'choma_zone') {
    return type === 'choma_zone';
  }
  // For 'restaurant' scope: include restaurant shifts plus bar/cashier shifts
  // so food and recalled items from Main Bar/Executive Bar are fetched and filtered by isKitchenVisiblePosOrder
  return type !== 'choma_zone';
};

const activeKitchenStatuses = new Set(['pending', 'preparing', 'ready', 'recalled', 'void_requested', 'cancelled', 'voided']);
const KITCHEN_STOP_SIGNAL_LOOKBACK_HOURS = 36;

// True once captain_printed_at covers the order's current state: for a
// recalled order that means printed at/after the latest recall, not just
// printed at some point in the past. KDS auto-print uses this to skip
// reprinting an order it's already ticketed, instead of relying on
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

const isKitchenVisiblePosOrder = (order: any, isRestaurantShift: boolean = true): boolean => {
  const orderStatus = String(order?.status || '').toLowerCase();
  const paymentStatus = String(order?.payment_status || '').toLowerCase();
  const rawKitchenStatus = String(order?.kitchen_status || '').toLowerCase();
  const kitchenStatus = normalizeKitchenStatus(rawKitchenStatus || orderStatus);
  const voidRequestStatus = String(order?.void_request_status || '').toLowerCase();

  const items = Array.isArray(order?.items) ? order.items : [];
  const hasRecalledItem = items.some((item: any) => item?.is_recalled_item === true);

  if (!isRestaurantShift && !hasRecalledItem && kitchenStatus !== 'recalled') {
    const hasFoodItems = items.some((item: any) => {
      const itemGroup = String(item?.item_group || '').toLowerCase();
      if (['kitchen', 'restaurant', 'food', 'choma', 'pastry'].includes(itemGroup)) return true;
      const outletType = String(item?.outlet_type || '').toLowerCase();
      if (['restaurant', 'choma_zone', 'kitchen'].includes(outletType)) return true;
      const name = String(item?.name || item?.item_name || '').toLowerCase();
      const category = String(item?.category || item?.department || '').toLowerCase();
      return category.includes('food') || category.includes('kitchen') || category.includes('choma') || category.includes('grill') || category.includes('snack') || category.includes('accompaniment') || category.includes('breakfast') || category.includes('meal') || category.includes('pastr') || category.includes('hot beverage') ||
             name.includes('chips') || name.includes('meat') || name.includes('chicken') || name.includes('fish') || name.includes('rice') || name.includes('soup') || name.includes('choma') || name.includes('fry') || name.includes('beef') || name.includes('pork') || name.includes('ugali') || name.includes('samosa') || name.includes('mandazi') || name.includes('chapati') || name.includes('sausage') || name.includes('egg') || name.includes('burger') || name.includes('sandwich');
    });
    if (!hasFoodItems) return false;
  }

  // Kitchen must always see orders it hasn't finished yet, regardless of payment
  if (['pending', 'preparing', 'ready', 'recalled'].includes(kitchenStatus) || hasRecalledItem) return true;
  if (['served', 'completed'].includes(kitchenStatus) && !hasRecalledItem) return false;
  if (orderStatus === 'open' && ['unpaid', 'partial'].includes(paymentStatus)) return true;
  if (['pending', 'approved'].includes(voidRequestStatus)) return true;
  if (['void_requested', 'cancelled', 'voided'].includes(kitchenStatus)) return true;
  return orderStatus === 'voided' || paymentStatus === 'voided';
};

// Status -> {label, color} for the KDS void chip. Both item-level and
// whole-bill voids now go through the same three-stage chain: Kitchen
// acknowledge -> Cashier acknowledge (financial effect applied) -> Branch
// Accountant final approval.
const ITEM_VOID_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING KITCHEN', color: 'amber' },
  kitchen_acknowledged: { label: 'PENDING CASHIER', color: 'amber' },
  void_kitchen_declined: { label: 'KITCHEN DECLINED', color: 'grey' },
  void_acknowledged: { label: 'VOID ACKNOWLEDGED', color: 'orange' },
  approved: { label: 'APPROVED', color: 'green' },
  rejected: { label: 'REJECTED', color: 'red' },
  void_cashier_declined: { label: 'CASHIER DECLINED', color: 'grey' }
};

const WHOLE_BILL_VOID_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING KITCHEN', color: 'amber' },
  kitchen_acknowledged: { label: 'PENDING CASHIER', color: 'amber' },
  void_kitchen_declined: { label: 'KITCHEN DECLINED', color: 'grey' },
  cashier_acknowledged: { label: 'PENDING APPROVAL', color: 'orange' },
  void_cashier_declined: { label: 'CASHIER DECLINED', color: 'grey' },
  approved: { label: 'APPROVED', color: 'green' },
  rejected: { label: 'REJECTED', color: 'red' }
};

const mapVoidStatus = (
  status: string | null | undefined,
  meta: Record<string, { label: string; color: string }>
): { status: string; label: string; color: string } | null => {
  const key = String(status || '').toLowerCase();
  const entry = meta[key];
  return entry ? { status: key, ...entry } : null;
};

const resolveKitchenBranchId = (req: express.Request): number | undefined => {
  const queryBranch = Number(req.query.branch_id);
  if (Number.isFinite(queryBranch) && queryBranch > 0) return queryBranch;
  const userBranch = Number((req.user as any)?.branch_id ?? (req.user as any)?.branchId);
  if (Number.isFinite(userBranch) && userBranch > 0) return userBranch;
  return undefined;
};

// KDS History and Order Intelligence must reset per kitchen shift rather
// than bleeding a flat multi-day window together — otherwise a "Rush Window"
// or "Top Item" shown to today's cooks can really be from a shift days ago.
// Scopes to the branch's currently open kitchen_shifts row; if none is open
// right now (between shifts), falls back to the most recently closed one so
// the screen isn't empty, rather than reaching further back into whatever
// shift came before that. No kitchen shift ever opened for this branch
// falls back to a 24h window.
const resolveKitchenHistoryWindow = async (
  branchId: number | undefined
): Promise<string> => {
  const fallback = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (!branchId) return fallback;

  try {
    const { data: openShift } = await supabase
      .from('kitchen_shifts')
      .select('opened_at')
      .eq('branch_id', branchId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openShift?.opened_at) return openShift.opened_at;

    const { data: lastShift } = await supabase
      .from('kitchen_shifts')
      .select('opened_at')
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastShift?.opened_at) return lastShift.opened_at;
  } catch {
    // kitchen_shifts not migrated yet on this environment — fall back below.
  }
  return fallback;
};

const posItemKey = (item: any, index: number): string => {
  const base = String(item?.outlet_item_id || item?.id || item?.menu_item_id || item?.sku || item?.name || 'item');
  const recallBatch = item?.recall_batch_id ? `:${item.recall_batch_id}` : '';
  return `${base}${recallBatch}:${index}`;
};

const posOrderType = (order: any): string => {
  const explicit = String(order?.order_type || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (String(order?.customer_name || '').match(/^Table\s+/i)) return 'dine_in';
  if (String(order?.customer_name || '').match(/^Room\s+/i)) return 'room_service';
  return 'takeaway';
};

const posOrderTableNumber = (order: any): string | null => {
  const explicit = order?.table_number;
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) return String(explicit).trim();
  const match = String(order?.customer_name || '').match(/^Table\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const posOrderRoomNumber = (order: any): string | null => {
  const explicit = order?.room_number;
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) return String(explicit).trim();
  const match = String(order?.customer_name || '').match(/^Room\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const notifyWaiterCaptainOrderReady = async (order: any): Promise<void> => {
  const waiterId = order?.waiter_id || order?.created_by;
  if (!waiterId) return;

  let branchId: number | null = null;
  if (order?.shift_id) {
    const { data } = await supabase
      .from('pos_outlet_shifts')
      .select('branch_id')
      .eq('id', order.shift_id)
      .maybeSingle();
    branchId = Number(data?.branch_id) || null;
  }

  await notificationService.notifyUser(
    String(waiterId),
    'Captain order ready',
    `${order?.order_number || 'Captain order'} is ready. Open Active Orders to serve or collect it.`,
    {
      type: 'success',
      category: 'restaurant_order',
      priority: 'high',
      actionUrl: '/dashboard/pos-kitchen?view=active-orders',
      metadata: {
        target: 'active_orders',
        source: 'pos_shift_order',
        order_id: order?.id,
        branch_id: branchId
      }
    }
  );
};

// Dine-in counterpart to notifyWaiterCaptainOrderReady above — for orders
// that live in restaurant_orders/restaurant_order_items rather than
// pos_shift_orders (see the /kitchen/orders/:orderId/items/:itemId/ready
// handler's non-"pos:" branch).
const notifyDineInOrderReady = async (orderId: string): Promise<void> => {
  const { data: order } = await supabase
    .from('restaurant_orders')
    .select('id, order_number, created_by, branch_id, table_number')
    .eq('id', orderId)
    .maybeSingle();
  if (!order?.created_by) return;

  await notificationService.notifyUser(
    String(order.created_by),
    'Order ready',
    `${order.order_number || 'Order'}${order.table_number ? ` (Table ${order.table_number})` : ''} is ready to serve.`,
    {
      type: 'success',
      category: 'kds_ready',
      priority: 'high',
      actionUrl: '/dashboard/pos-kitchen?view=active-orders',
      metadata: {
        target: 'active_orders',
        source: 'restaurant_order',
        order_id: order.id,
        branch_id: order.branch_id ?? null
      }
    }
  );
};

const updatePosCaptainOrderKitchenStatus = async (rawOrderId: string, status: string) => {
  const orderId = rawOrderId.replace(/^pos:/, '');
  const patch: Record<string, any> = {
    kitchen_status: status,
    updated_at: new Date().toISOString()
  };
  if (status === 'preparing') patch.kitchen_started_at = new Date().toISOString();
  if (status === 'ready') patch.kitchen_ready_at = new Date().toISOString();
  if (status === 'served') patch.kitchen_served_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('pos_shift_orders')
    .update(patch)
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  if (status === 'ready') {
    notifyWaiterCaptainOrderReady(data).catch((error) => {
      console.warn('[KDS] Failed to notify waiter for ready captain order', error);
    });
  }
  return data;
};

// Public routes
router.get(
  '/menu/categories',
  withCache(
    (req) => CacheKeys.menuCategory(resolveMenuBranchId(req), 'all-categories'),
    CACHE_TTL.MENU,
    { skipCache: (req) => resolveMenuBranchId(req) <= 0 }
  ),
  getMenuCategories
);
router.get(
  '/menu/items',
  withCache(
    (req) => CacheKeys.menuFiltered(resolveMenuBranchId(req), resolveMenuFilterSignature(req)),
    CACHE_TTL.MENU,
    { skipCache: (req) => resolveMenuBranchId(req) <= 0 }
  ),
  getMenuItems
);

// Protected routes
router.use(protect);

router.post('/categories',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.BRANCH_ACCOUNTANT]),
  createCategory
);

router.post('/menu/categories',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.BRANCH_ACCOUNTANT]),
  createCategory
);

// Guest and staff routes
router.get('/orders/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST]),
  getOrder
);

// Staff routes
router.post('/orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]),
  optionalIdempotency({
    scope: 'restaurant.create-order',
    resourceResolver: (body) => ({
      resourceId: body?.data?.id || null,
      resourceType: body?.data?.order_number ? 'restaurant_order' : null
    })
  }),
  createOrder
);

router.get('/orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN, UserRole.AUDITOR]),
  getOrders
);

router.post('/orders/:id/items',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]),
  addItemsToOrder
);

// Restaurant staff routes
router.post('/menu/items',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.BRANCH_ACCOUNTANT]),
  createMenuItem
);

router.put('/menu/items/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.BRANCH_ACCOUNTANT]),
  updateMenuItem
);

router.delete('/menu/items/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.BRANCH_ACCOUNTANT]),
  deleteMenuItem
);

router.put('/menu/items/:id/toggle',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.BRANCH_ACCOUNTANT]),
  toggleItemAvailability
);

// Menu item image upload
router.post('/menu/items/:id/image',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.BRANCH_ACCOUNTANT]),
  uploadMenuItemImage
);

router.delete('/menu/items/:id/image',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.BRANCH_ACCOUNTANT]),
  deleteMenuItemImage
);

router.put('/orders/:id/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]),
  updateOrderStatus
);

router.get('/inventory',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  getInventoryItems
);

router.post('/inventory/:id/stock',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  updateInventoryStock
);

// Room Service routes
router.post('/room-service',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]),
  createRoomServiceOrder
);

router.get('/room-service',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]),
  getRoomServiceOrders
);

router.put('/room-service/:id/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  updateRoomServiceOrderStatus
);

// Reports - Daily Sales
router.get('/reports/daily-sales',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN, UserRole.AUDITOR]),
  getDailySales
);

const KITCHEN_ORDER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.RESTAURANT,
  UserRole.RESTAURANT_MANAGER,
  UserRole.KITCHEN,
  UserRole.POS_KITCHEN,
  UserRole.CHOMA_ZONE_KDS,
  UserRole.KITCHEN_OPERATIONS,
  UserRole.HEAD_CHEF,
  UserRole.SOUS_CHEF,
  UserRole.LINE_COOK,
  UserRole.PREP_COOK,
  UserRole.AUDITOR,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.FINANCE_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.STOREKEEPER,
];

// Kitchen Display - Get active orders (no join, avoids FK issues)
router.get('/kitchen/orders',
  withCache(
    (req) => CacheKeys.kitchenOrders(
      kitchenCacheBranchId(req),
      resolveKitchenScope(req),
    ),
    CACHE_TTL.KDS_ACTIVE,
  ),
  authorize(KITCHEN_ORDER_ROLES),
  async (req, res) => {
    try {
      const branchId = resolveKitchenBranchId(req);
      const outletScope = normalizeKitchenOutletScope(req.query.outlet_scope);
      const stopSignalSince = new Date(Date.now() - KITCHEN_STOP_SIGNAL_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
      let orders: any[] = [];

      if (shouldIncludeRestaurantOrders(outletScope)) {
        let ordersQuery = supabase
          .from('restaurant_orders')
          .select('id, branch_id, order_number, short_code, order_type, table_number, room_number, waiter_name, customer_name, status, total_amount, created_at, captain_printed_at')
          .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'cancelled', 'voided'])
          .order('created_at', { ascending: true });

        if (branchId) {
          ordersQuery = ordersQuery.eq('branch_id', branchId);
        }

        const { data: restaurantOrders, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;
        orders = restaurantOrders || [];
      }

      // Fetch order items separately to avoid FK join issues
      const orderIds = orders.map((o: any) => o.id);
      let allItems: any[] = [];
      let itemsError: any = null;
      if (orderIds.length) {
        const itemsResult = await supabase
          .from('restaurant_order_items')
          .select('id, order_id, menu_item_id, quantity, unit_price, total_price, special_instructions, item_name, kitchen_status, kitchen_ready_at')
          .in('order_id', orderIds);
        allItems = itemsResult.data || [];
        itemsError = itemsResult.error;
      }

      if (itemsError) {
        console.warn('Failed to fetch order items:', itemsError.message);
      }

      const itemsByOrder: Record<string, any[]> = {};
      for (const item of (allItems || [])) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      }

      const ordersWithTime = orders.map((order: any) => {
        const items = itemsByOrder[order.id] || [];
        return {
          ...order,
          elapsed_minutes: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000),
          items_count: items.length,
          total: order.total_amount,
          captain_order_already_printed: isCaptainOrderAlreadyPrinted(order, items),
          items: items.map((item: any) => ({
            id: item.id,
            name: item.item_name || `Item #${item.menu_item_id}`,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.special_instructions,
            status: item.kitchen_status || 'pending',
            is_ready: item.kitchen_status === 'ready',
            kitchen_ready_at: item.kitchen_ready_at
          }))
        };
      });

      let posOrdersWithTime: any[] = [];
      try {
        let shiftQuery = supabase
          .from('pos_outlet_shifts')
          .select('id, branch_id, outlet_id, status, opened_at, outlet:pos_outlets(name, outlet_type)')
          .or(`status.eq.open,opened_at.gte.${stopSignalSince}`)
          .order('opened_at', { ascending: false })
          .limit(250);

        if (branchId) {
          shiftQuery = shiftQuery.eq('branch_id', branchId);
        }

        const { data: outletShifts, error: shiftError } = await shiftQuery;
        if (shiftError) throw shiftError;


        // Only shifts whose outlet_type matches the requested KDS scope.
        // This is what isolates Choma Zone KDS from restaurant shifts and vice versa.
        const scopedShiftIds = (outletShifts || [])
          .filter((shift: any) => {
            const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
            return matchesKitchenOutletScope(outlet?.outlet_type, outletScope);
          })
          .map((shift: any) => shift.id);
        const restaurantShiftSet = new Set(
          (outletShifts || [])
            .filter((shift: any) => {
              const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
              return String(outlet?.outlet_type || '').trim().toLowerCase() === 'restaurant';
            })
            .map((shift: any) => shift.id)
        );
        const shiftsById = new Map((outletShifts || []).map((shift: any) => [shift.id, shift]));

        if (scopedShiftIds.length) {
          const { data: posOrders, error: posOrdersError } = await supabase
            .from('pos_shift_orders')
            .select('id, shift_id, outlet_id, order_number, short_code, customer_name, waiter_name, order_type, table_number, room_number, status, payment_status, kitchen_status, void_request_status, void_reason, voided_at, voided_by, is_exchange, exchange_parent_order_id, created_at, total_amount, captain_printed_at, items')
            .in('shift_id', scopedShiftIds)
            .gte('created_at', stopSignalSince)
            .or('status.eq.open,status.eq.voided,payment_status.eq.voided,void_request_status.in.(pending,approved),kitchen_status.in.(void_requested,cancelled,voided,pending,preparing,ready,recalled)')
            .order('created_at', { ascending: true });

          if (posOrdersError) throw posOrdersError;

          // Item-level void requests are never written to kitchen_status, so the
          // kitchen has no visibility into them unless we attach them here.
          // Only the latest request per (order_id, item_index) is kept — a
          // resolved (declined/rejected/approved) request can be superseded by
          // a fresh one on the same line.
          const posOrderIds = (posOrders || []).map((o: any) => o.id);
          const itemVoidsByOrder: Record<string, Record<number, any>> = {};
          if (posOrderIds.length) {
            const { data: itemVoidRows, error: itemVoidError } = await supabase
              .from('pos_item_void_requests')
              .select('order_id, item_index, item_name, qty_to_void, reason, status, created_at')
              .in('order_id', posOrderIds)
              .gte('created_at', stopSignalSince);
            if (itemVoidError) {
              console.warn('Failed to fetch item void requests for kitchen display:', itemVoidError.message);
            } else {
              for (const row of (itemVoidRows || [])) {
                const byItem = itemVoidsByOrder[row.order_id] || (itemVoidsByOrder[row.order_id] = {});
                const existing = byItem[row.item_index];
                if (!existing || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
                  byItem[row.item_index] = row;
                }
              }
            }
          }

          posOrdersWithTime = (posOrders || []).filter((order: any) => isKitchenVisiblePosOrder(order, restaurantShiftSet.has(order.shift_id))).map((order: any) => {
            const shift = shiftsById.get(order.shift_id) || {};
            const shiftOutlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
            const orderItems = Array.isArray(order.items) ? order.items : [];
            const itemVoidsForOrder = itemVoidsByOrder[order.id] || {};
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
              order_type: posOrderType(order),
              table_number: posOrderTableNumber(order),
              room_number: posOrderRoomNumber(order),
              waiter_name: order.waiter_name,
              customer_name: order.customer_name || 'Walk-in',
              status: normalizeKitchenStatus(order.kitchen_status || order.status),
              order_status: order.status,
              payment_status: order.payment_status,
              void_request_status: order.void_request_status,
              void_reason: order.void_reason,
              void_status: mapVoidStatus(order.void_request_status, WHOLE_BILL_VOID_STATUS_META),
              voided_at: order.voided_at,
              voided_by: order.voided_by,
              is_exchange: order.is_exchange === true,
              exchange_parent_order_id: order.exchange_parent_order_id || null,
              created_at: order.created_at,
              elapsed_minutes: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000),
              items_count: orderItems.length,
              total: order.total_amount,
              total_amount: order.total_amount,
              captain_order_already_printed: isCaptainOrderAlreadyPrinted(order, orderItems),
              items: orderItems.map((item: any, index: number) => {
                const itemStatus = normalizeKitchenStatus(item.kitchen_status || item.status || order.kitchen_status);
                const itemVoidRow = itemVoidsForOrder[index];
                const itemVoidMeta = itemVoidRow ? mapVoidStatus(itemVoidRow.status, ITEM_VOID_STATUS_META) : null;
                return {
                id: posItemKey(item, index),
                name: item.name || item.item_name || 'POS item',
                quantity: Number(item.quantity || item.qty || 1),
                unit_price: Number(item.unit_price || item.price || 0),
                notes: item.notes,
                is_recalled_item: item.is_recalled_item === true,
                recall_batch_id: item.recall_batch_id || null,
                recalled_at: item.recalled_at || null,
                recall_note: item.recall_note || null,
                status: itemStatus,
                is_ready: itemStatus === 'ready',
                void_request: itemVoidMeta
                  ? {
                      ...itemVoidMeta,
                      reason: itemVoidRow.reason,
                      qty_to_void: Number(itemVoidRow.qty_to_void || 0)
                    }
                  : null
              };
              })
            };
          });
        }
      } catch (posError: any) {
        console.warn('Failed to fetch POS captain orders for kitchen display:', posError?.message || posError);
      }

      const activeOrders = [...ordersWithTime, ...posOrdersWithTime]
        .filter((order: any) => activeKitchenStatuses.has(normalizeKitchenStatus(order.status)));
      res.json({ success: true, data: activeOrders });
    } catch (error) {
      console.error('Kitchen orders error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch kitchen orders' });
    }
  }
);

// Kitchen Display - Get completed restaurant order history (restaurant only)
router.get('/kitchen/orders/history',
  withCache(
    (req) => CacheKeys.kitchenHistory(
      kitchenCacheBranchId(req),
      resolveKitchenScope(req),
      kitchenCacheLimit(req),
      kitchenCacheTimeline(req),
    ),
    CACHE_TTL.KDS_ACTIVE,
  ),
  authorize(KITCHEN_ORDER_ROLES),
  async (req, res) => {
    try {
      const branchId = resolveKitchenBranchId(req);
      const outletScope = normalizeKitchenOutletScope(req.query.outlet_scope);
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 250);
      const timeline = String(req.query.timeline || 'shift').toLowerCase();

      let historySince: string;
      let historyUntil: string | null = null;
      if (timeline === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        historySince = today.toISOString();
      } else if (timeline === 'yesterday') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        historyUntil = today.toISOString();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        yesterday.setHours(0, 0, 0, 0);
        historySince = yesterday.toISOString();
      } else if (timeline === '7days') {
        historySince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (timeline === 'all') {
        historySince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        // Default: current active kitchen shift
        historySince = await resolveKitchenHistoryWindow(branchId);
      }

      let orders: any[] = [];

      if (shouldIncludeRestaurantOrders(outletScope)) {
        let ordersQuery = supabase
          .from('restaurant_orders')
          .select('id, branch_id, order_number, short_code, order_type, table_number, room_number, waiter_name, customer_name, status, total_amount, created_at, captain_printed_at, updated_at')
          .in('status', ['served', 'delivered', 'completed', 'paid', 'cancelled', 'voided'])
          .gte('created_at', historySince)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (historyUntil) {
          ordersQuery = ordersQuery.lt('created_at', historyUntil);
        }

        if (branchId) {
          ordersQuery = ordersQuery.eq('branch_id', branchId);
        }

        const { data: restaurantOrders, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;
        orders = restaurantOrders || [];
      }

      const orderIds = orders.map((o: any) => o.id);
      let allItems: any[] = [];
      if (orderIds.length) {
        const itemsResult = await supabase
          .from('restaurant_order_items')
          .select('id, order_id, menu_item_id, quantity, unit_price, total_price, special_instructions, item_name, kitchen_status, kitchen_ready_at')
          .in('order_id', orderIds);
        allItems = itemsResult.data || [];
        if (itemsResult.error) {
          console.warn('Failed to fetch kitchen order history items:', itemsResult.error.message);
        }
      }

      const itemsByOrder: Record<string, any[]> = {};
      for (const item of (allItems || [])) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      }

      const history = orders.map((order: any) => {
        const items = itemsByOrder[order.id] || [];
        return {
          ...order,
          elapsed_minutes: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000),
          items_count: items.length,
          total: order.total_amount,
          items: items.map((item: any) => ({
            id: item.id,
            name: item.item_name || `Item #${item.menu_item_id}`,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.special_instructions,
            status: item.kitchen_status || 'ready',
            is_ready: (item.kitchen_status || 'ready') === 'ready',
            kitchen_ready_at: item.kitchen_ready_at
          }))
        };
      });

      let posHistory: any[] = [];
      try {
        const shiftLookbackSince = new Date(
          Math.min(
            new Date(historySince).getTime(),
            Date.now() - KITCHEN_STOP_SIGNAL_LOOKBACK_HOURS * 60 * 60 * 1000,
          )
        ).toISOString();
        let shiftQuery = supabase
          .from('pos_outlet_shifts')
          .select('id, branch_id, outlet_id, status, opened_at, outlet:pos_outlets(name, outlet_type)')
          .or(`status.eq.open,opened_at.gte.${shiftLookbackSince}`)
          .order('opened_at', { ascending: false })
          .limit(1000);

        if (branchId) {
          shiftQuery = shiftQuery.eq('branch_id', branchId);
        }

        const { data: outletShifts, error: shiftError } = await shiftQuery;
        if (shiftError) throw shiftError;

        const restaurantShiftIds = (outletShifts || [])
          .filter((shift: any) => {
            const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
            return matchesKitchenOutletScope(outlet?.outlet_type, outletScope);
          })
          .map((shift: any) => shift.id);
        const shiftsById = new Map((outletShifts || []).map((shift: any) => [shift.id, shift]));

        if (restaurantShiftIds.length) {
          let posQuery = supabase
            .from('pos_shift_orders')
            .select('id, shift_id, outlet_id, order_number, short_code, customer_name, waiter_name, order_type, table_number, room_number, status, payment_status, kitchen_status, void_request_status, void_reason, voided_at, voided_by, is_exchange, exchange_parent_order_id, created_at, updated_at, total_amount, captain_printed_at, items')
            .in('shift_id', restaurantShiftIds)
            .gte('created_at', historySince)
            .or('kitchen_status.in.(served,cancelled,voided),status.in.(paid,credit_bill,voided,cancelled),payment_status.in.(paid,credit_bill,voided)')
            .order('created_at', { ascending: false })
            .limit(limit);

          if (historyUntil) {
            posQuery = posQuery.lt('created_at', historyUntil);
          }

          const { data: posOrders, error: posOrdersError } = await posQuery;

          if (posOrdersError) throw posOrdersError;

          posHistory = (posOrders || []).map((order: any) => {
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
              order_type: posOrderType(order),
              table_number: posOrderTableNumber(order),
              room_number: posOrderRoomNumber(order),
              waiter_name: order.waiter_name,
              customer_name: order.customer_name || 'Walk-in',
              status: normalizeKitchenStatus(order.kitchen_status || order.status),
              order_status: order.status,
              payment_status: order.payment_status,
              void_request_status: order.void_request_status,
              void_reason: order.void_reason,
              voided_at: order.voided_at,
              voided_by: order.voided_by,
              created_at: order.created_at,
              updated_at: order.updated_at,
              elapsed_minutes: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000),
              items_count: orderItems.length,
              total: order.total_amount,
              total_amount: order.total_amount,
              items: orderItems.map((item: any, index: number) => {
                const itemStatus = normalizeKitchenStatus(item.kitchen_status || item.status || order.kitchen_status || 'ready');
                return {
                  id: posItemKey(item, index),
                  name: item.name || item.item_name || 'POS item',
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
          });
        }
      } catch (posError: any) {
        console.warn('Failed to fetch POS captain order history for kitchen display:', posError?.message || posError);
      }

      const combinedHistory = [...history, ...posHistory]
        .sort((a: any, b: any) => new Date(b.created_at || b.updated_at).getTime() - new Date(a.created_at || a.updated_at).getTime())
        .slice(0, limit);

      res.json({ success: true, data: combinedHistory });
    } catch (error) {
      console.error('Kitchen order history error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch kitchen order history' });
    }
  }
);

// Kitchen Display - Update prep status without clearing cashier payment state.
router.put('/kitchen/orders/:orderId/status',
  authorize(KITCHEN_ORDER_ROLES),
  async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const status = normalizeKitchenStatus(req.body.status);
      if (!['pending', 'preparing', 'ready', 'served', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid kitchen status' });
      }

      if (orderId.startsWith('pos:')) {
        const updatedOrder = await updatePosCaptainOrderKitchenStatus(orderId, status);
        return res.json({ success: true, data: updatedOrder });
      }

      const { data: updatedOrder, error } = await supabase
        .from('restaurant_orders')
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...(status === 'preparing' ? { prepared_at: new Date().toISOString() } : {}),
          ...(status === 'ready' ? { prepared_at: new Date().toISOString() } : {}),
          ...(status === 'served' ? { delivered_at: new Date().toISOString() } : {})
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return res.json({ success: true, data: updatedOrder });
    } catch (error) {
      next(error);
    }
  }
);

// Kitchen Display - report a successful client-side backup print, so this
// order's current state (creation or latest recall) is marked printed and
// won't be reprinted on the next poll or after the KDS screen remounts
// (e.g. the operator logging out and back in).
router.put('/kitchen/orders/:orderId/printed',
  authorize(KITCHEN_ORDER_ROLES),
  async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const printedAt = new Date().toISOString();

      if (orderId.startsWith('pos:')) {
        const realId = orderId.replace(/^pos:/, '');
        const { error } = await supabase
          .from('pos_shift_orders')
          .update({ captain_printed_at: printedAt })
          .eq('id', realId);
        if (error) throw error;
        return res.json({ success: true });
      }

      const { error } = await supabase
        .from('restaurant_orders')
        .update({ captain_printed_at: printedAt })
        .eq('id', orderId);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Kitchen Display - Mark item as ready
router.put('/kitchen/orders/:orderId/items/:itemId/ready',
  authorize(KITCHEN_ORDER_ROLES),
  async (req, res, next) => {
    try {
      const { orderId, itemId } = req.params;

      if (orderId.startsWith('pos:')) {
        const posOrderId = orderId.replace(/^pos:/, '');
        const { data: order, error: getError } = await supabase
          .from('pos_shift_orders')
          .select('id, shift_id, order_number, short_code, waiter_id, created_by, items')
          .eq('id', posOrderId)
          .single();

        if (getError || !order) {
          return res.status(404).json({ success: false, message: 'POS captain order not found' });
        }

        const items = Array.isArray(order.items) ? order.items : [];
        const updatedItems = items.map((item: any, index: number) =>
          posItemKey(item, index) === itemId
            ? { ...item, kitchen_status: 'ready', kitchen_ready_at: new Date().toISOString() }
            : item
        );
        const allReady = updatedItems.length > 0 &&
          updatedItems.every((item: any) => normalizeKitchenStatus(item.kitchen_status || item.status) === 'ready');

        const { error: updateError } = await supabase
          .from('pos_shift_orders')
          .update({
            items: updatedItems,
            ...(allReady ? {
              kitchen_status: 'ready',
              kitchen_ready_at: new Date().toISOString()
            } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', posOrderId);
        if (updateError) throw updateError;

        if (allReady) {
          notifyWaiterCaptainOrderReady(order).catch((error) => {
            console.warn('[KDS] Failed to notify waiter for ready captain item order', error);
          });
        }

        return res.json({
          success: true,
          message: 'POS captain item marked as ready',
          data: { orderId, itemId, status: 'ready', allReady }
        });
      }

      // kitchen_status/kitchen_ready_at/kitchen_ready_by (used by the POS
      // captain-order branch above) don't exist as columns on this table —
      // restaurant_order_items only has is_ready/status. This previously
      // threw a "column does not exist" error on every call.
      const { data, error } = await supabase
        .from('restaurant_order_items')
        .update({
          is_ready: true,
          status: 'ready'
        })
        .eq('order_id', orderId)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;

      // Notify the waiter once every item on the order is ready — mirrors
      // notifyWaiterCaptainOrderReady's "all ready" gate for POS captain
      // orders above, so dine-in table orders (routed through
      // restaurant_orders/restaurant_order_items, not pos_shift_orders)
      // get the same "order ready" alert instead of none at all.
      const { data: siblingItems } = await supabase
        .from('restaurant_order_items')
        .select('is_ready')
        .eq('order_id', orderId);
      const allReady = Array.isArray(siblingItems) &&
        siblingItems.length > 0 &&
        siblingItems.every((item: any) => item.is_ready === true);

      if (allReady) {
        notifyDineInOrderReady(orderId).catch((notifyError) => {
          console.warn('[KDS] Failed to notify waiter for ready dine-in order', notifyError);
        });
      }

      res.json({
        success: true,
        message: 'Item marked as ready',
        data: data || { orderId, itemId, status: 'ready' }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ WASTAGE RECORDING ROUTES ============

// Get items that can be wasted (menu items + inventory)
router.get('/wastage/items',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]),
  getWastageItems
);

// Get wastage records
router.get('/wastage',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]),
  getWastageRecords
);

// Get wastage summary/stats
router.get('/wastage/summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]),
  getWastageSummary
);

// Create wastage record
router.post('/wastage',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]),
  createWastageRecord
);

// Update wastage record
router.put('/wastage/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]),
  updateWastageRecord
);

// Delete wastage record
router.delete('/wastage/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN]),
  deleteWastageRecord
);

// Register sub-routes
router.use('/tables', tableRoutes);
router.use('/reservations', reservationRoutes);

export default router;
