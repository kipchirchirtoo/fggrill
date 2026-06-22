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
import { UserRole } from '../models/User';
import notificationService from '../services/notification.service';

// Import new sub-routes
import tableRoutes from './restaurant.table.routes';
import reservationRoutes from './restaurant.reservation.routes';

const router = express.Router();

const normalizeKitchenStatus = (value: any): string => {
  const status = String(value || 'pending').toLowerCase();
  return ['pending', 'confirmed'].includes(status) ? 'pending' : status;
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

const isKitchenVisiblePosOrder = (order: any): boolean => {
  const orderStatus = String(order?.status || '').toLowerCase();
  const paymentStatus = String(order?.payment_status || '').toLowerCase();
  const rawKitchenStatus = String(order?.kitchen_status || '').toLowerCase();
  const kitchenStatus = normalizeKitchenStatus(rawKitchenStatus || orderStatus);
  const voidRequestStatus = String(order?.void_request_status || '').toLowerCase();

  // Kitchen must always see orders it hasn't finished yet, regardless of payment
  if (['pending', 'preparing', 'ready', 'recalled'].includes(kitchenStatus)) return true;
  if (['served', 'completed'].includes(kitchenStatus)) return false;
  if (orderStatus === 'open' && ['unpaid', 'partial'].includes(paymentStatus)) return true;
  if (['pending', 'approved'].includes(voidRequestStatus)) return true;
  if (['void_requested', 'cancelled', 'voided'].includes(kitchenStatus)) return true;
  return orderStatus === 'voided' || paymentStatus === 'voided';
};

// Status -> {label, color} for the KDS void chip. Item-level voids go through
// the full two-stage flow (cashier then manager); whole-bill voids skip the
// cashier stage entirely, so they only ever use 3 of the 5 states.
const ITEM_VOID_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING CASHIER', color: 'amber' },
  void_acknowledged: { label: 'VOID ACKNOWLEDGED', color: 'orange' },
  approved: { label: 'APPROVED', color: 'green' },
  rejected: { label: 'REJECTED', color: 'red' },
  void_cashier_declined: { label: 'CASHIER DECLINED', color: 'grey' }
};

const WHOLE_BILL_VOID_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING APPROVAL', color: 'amber' },
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
router.get('/menu/categories', getMenuCategories);
router.get('/menu/items', getMenuItems);

// Protected routes
router.use(protect);

router.post('/categories',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]),
  createCategory
);

router.post('/menu/categories',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]),
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]),
  createMenuItem
);

router.put('/menu/items/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]),
  updateMenuItem
);

router.delete('/menu/items/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]),
  deleteMenuItem
);

router.put('/menu/items/:id/toggle',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]),
  toggleItemAvailability
);

// Menu item image upload
router.post('/menu/items/:id/image',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]),
  uploadMenuItemImage
);

router.delete('/menu/items/:id/image',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]),
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

// Kitchen Display - Get active orders (no join, avoids FK issues)
router.get('/kitchen/orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]),
  async (req, res) => {
    try {
      const branchId = resolveKitchenBranchId(req);
      const stopSignalSince = new Date(Date.now() - KITCHEN_STOP_SIGNAL_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

      let ordersQuery = supabase
        .from('restaurant_orders')
        .select('*')
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'cancelled', 'voided'])
        .order('created_at', { ascending: true });

      if (branchId) {
        ordersQuery = ordersQuery.eq('branch_id', branchId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      // Fetch order items separately to avoid FK join issues
      const orderIds = (orders || []).map((o: any) => o.id);
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

      const ordersWithTime = (orders || []).map((order: any) => {
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

        const restaurantShiftIds = (outletShifts || [])
          .filter((shift: any) => {
            const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
            return String(outlet?.outlet_type || '').toLowerCase() === 'restaurant';
          })
          .map((shift: any) => shift.id);
        const shiftsById = new Map((outletShifts || []).map((shift: any) => [shift.id, shift]));

        if (restaurantShiftIds.length) {
          const { data: posOrders, error: posOrdersError } = await supabase
            .from('pos_shift_orders')
            .select('*')
            .in('shift_id', restaurantShiftIds)
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

          posOrdersWithTime = (posOrders || []).filter(isKitchenVisiblePosOrder).map((order: any) => {
            const shift = shiftsById.get(order.shift_id) || {};
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN, UserRole.AUDITOR]),
  async (req, res) => {
    try {
      const branchId = resolveKitchenBranchId(req);
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 250);

      let ordersQuery = supabase
        .from('restaurant_orders')
        .select('*')
        .in('status', ['served', 'delivered', 'completed', 'paid', 'cancelled', 'voided'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (branchId) {
        ordersQuery = ordersQuery.eq('branch_id', branchId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      const orderIds = (orders || []).map((o: any) => o.id);
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

      const history = (orders || []).map((order: any) => {
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
        let shiftQuery = supabase
          .from('pos_outlet_shifts')
          .select('id, branch_id, outlet_id, outlet:pos_outlets(name, outlet_type)')
          .order('opened_at', { ascending: false })
          .limit(250);

        if (branchId) {
          shiftQuery = shiftQuery.eq('branch_id', branchId);
        }

        const { data: outletShifts, error: shiftError } = await shiftQuery;
        if (shiftError) throw shiftError;

        const restaurantShiftIds = (outletShifts || [])
          .filter((shift: any) => {
            const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
            return String(outlet?.outlet_type || '').toLowerCase() === 'restaurant';
          })
          .map((shift: any) => shift.id);
        const shiftsById = new Map((outletShifts || []).map((shift: any) => [shift.id, shift]));

        if (restaurantShiftIds.length) {
          const { data: posOrders, error: posOrdersError } = await supabase
            .from('pos_shift_orders')
            .select('*')
            .in('shift_id', restaurantShiftIds)
            .or('kitchen_status.in.(served,cancelled,voided),status.in.(paid,credit_bill,voided,cancelled),payment_status.in.(paid,credit_bill,voided)')
            .order('updated_at', { ascending: false })
            .limit(limit);

          if (posOrdersError) throw posOrdersError;

          posHistory = (posOrders || []).map((order: any) => {
            const shift = shiftsById.get(order.shift_id) || {};
            const orderItems = Array.isArray(order.items) ? order.items : [];
            return {
              id: `pos:${order.id}`,
              source: 'pos_shift_order',
              source_id: order.id,
              order_number: order.order_number,
              short_code: order.short_code,
              branch_id: shift.branch_id,
              outlet_id: order.outlet_id,
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
        .sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]),
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]),
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]),
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

      const { data, error } = await supabase
        .from('restaurant_order_items')
        .update({
          kitchen_status: 'ready',
          kitchen_ready_at: new Date().toISOString(),
          kitchen_ready_by: req.user?.id || null
        })
        .eq('order_id', orderId)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;

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
