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

      if (!orders || orders.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // Fetch order items separately to avoid FK join issues
      const orderIds = orders.map((o: any) => o.id);
      const { data: allItems, error: itemsError } = await supabase
        .from('restaurant_order_items')
        .select('id, order_id, menu_item_id, quantity, unit_price, total_price, special_instructions, item_name')
        .in('order_id', orderIds);

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

      res.json({ success: true, data: ordersWithTime });
    } catch (error) {
      console.error('Kitchen orders error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch kitchen orders' });
    }
  }
);

// Kitchen Display - Mark item as ready
router.put('/kitchen/orders/:orderId/items/:itemId/ready',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN]),
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
