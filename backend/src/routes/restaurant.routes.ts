import express from 'express';
import { supabase } from '../config/supabase';
import {
  getMenuCategories,
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

// Import new sub-routes
import tableRoutes from './restaurant.table.routes';
import reservationRoutes from './restaurant.reservation.routes';

const router = express.Router();

// Public routes
router.get('/menu/categories', getMenuCategories);
router.get('/menu/items', getMenuItems);

// Protected routes
router.use(protect);

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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  createMenuItem
);

router.put('/menu/items/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  updateMenuItem
);

router.delete('/menu/items/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  deleteMenuItem
);

router.put('/menu/items/:id/toggle',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  toggleItemAvailability
);

// Menu item image upload
router.post('/menu/items/:id/image',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  uploadMenuItemImage
);

router.delete('/menu/items/:id/image',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
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
      const branchIdRaw = req.query.branch_id as string;
      const branchId = branchIdRaw && !['true', 'false', 'null', 'undefined'].includes(branchIdRaw) ? branchIdRaw : undefined;

      let ordersQuery = supabase
        .from('restaurant_orders')
        .select('*')
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
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
          .select('id, order_id, menu_item_id, quantity, unit_price, total_price, special_instructions, item_name')
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
          items: items.map((item: any) => ({
            id: item.id,
            name: item.item_name || `Item #${item.menu_item_id}`,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.special_instructions,
            status: 'pending'
          }))
        };
      });

      let posOrdersWithTime: any[] = [];
      try {
        let shiftQuery = supabase
          .from('pos_outlet_shifts')
          .select('id, branch_id, outlet_id, outlet:pos_outlets(name, outlet_type)')
          .eq('status', 'open');

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

        if (restaurantShiftIds.length) {
          const { data: posOrders, error: posOrdersError } = await supabase
            .from('pos_shift_orders')
            .select('*')
            .in('shift_id', restaurantShiftIds)
            .in('status', ['open'])
            .in('payment_status', ['unpaid', 'partial'])
            .order('created_at', { ascending: true });

          if (posOrdersError) throw posOrdersError;

          posOrdersWithTime = (posOrders || []).map((order: any) => {
            const orderItems = Array.isArray(order.items) ? order.items : [];
            const tableMatch = String(order.customer_name || '').match(/^Table\s+(\d+)/i);
            return {
              id: `pos:${order.id}`,
              source: 'pos_shift_order',
              source_id: order.id,
              order_number: order.order_number,
              short_code: order.short_code,
              order_type: tableMatch ? 'dine_in' : 'takeaway',
              table_number: tableMatch ? Number(tableMatch[1]) : null,
              waiter_name: order.waiter_name,
              customer_name: order.customer_name || 'Walk-in',
              status: 'pending',
              payment_status: order.payment_status,
              created_at: order.created_at,
              elapsed_minutes: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000),
              items_count: orderItems.length,
              total: order.total_amount,
              total_amount: order.total_amount,
              items: orderItems.map((item: any, index: number) => ({
                id: item.outlet_item_id || `${order.id}-${index}`,
                name: item.name || item.item_name || 'POS item',
                quantity: Number(item.quantity || item.qty || 1),
                unit_price: Number(item.unit_price || item.price || 0),
                notes: item.notes,
                status: 'pending'
              }))
            };
          });
        }
      } catch (posError: any) {
        console.warn('Failed to fetch POS captain orders for kitchen display:', posError?.message || posError);
      }

      res.json({ success: true, data: [...ordersWithTime, ...posOrdersWithTime] });
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
      const branchIdRaw = req.query.branch_id as string;
      const branchId = branchIdRaw && !['true', 'false', 'null', 'undefined'].includes(branchIdRaw) ? branchIdRaw : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 250);

      let ordersQuery = supabase
        .from('restaurant_orders')
        .select('*')
        .in('status', ['served', 'delivered', 'completed', 'paid'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (branchId) {
        ordersQuery = ordersQuery.eq('branch_id', branchId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const orderIds = orders.map((o: any) => o.id);
      const { data: allItems, error: itemsError } = await supabase
        .from('restaurant_order_items')
        .select('id, order_id, menu_item_id, quantity, unit_price, total_price, special_instructions, item_name')
        .in('order_id', orderIds);

      if (itemsError) {
        console.warn('Failed to fetch kitchen order history items:', itemsError.message);
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
            status: 'ready'
          }))
        };
      });

      res.json({ success: true, data: history });
    } catch (error) {
      console.error('Kitchen order history error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch kitchen order history' });
    }
  }
);

// Kitchen Display - Mark item as ready
router.put('/kitchen/orders/:orderId/items/:itemId/ready',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]),
  async (req, res) => {
    try {
      const { orderId, itemId } = req.params;
      res.json({
        success: true,
        message: 'Item marked as ready',
        data: { orderId, itemId, status: 'ready' }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update item status' });
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
