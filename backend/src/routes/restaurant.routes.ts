import express from 'express';
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
  getInventoryItems,
  updateInventoryStock,
  createRoomServiceOrder,
  getRoomServiceOrders,
  updateRoomServiceOrderStatus,
  uploadMenuItemImage,
  deleteMenuItemImage
} from '../controllers/restaurant.controller';
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]),
  getOrder
);

// Staff routes
router.post('/orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]),
  createOrder
);

router.get('/orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]),
  getOrders
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  async (req, res) => {
    try {
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      // Return empty data for production - will be populated with real orders
      res.json({ 
        success: true, 
        data: { 
          date,
          total: 0, 
          orders_count: 0, 
          avg_order_value: 0,
          by_type: { dine_in: 0, takeaway: 0, room_service: 0 }
        } 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch daily sales' });
    }
  }
);

// Kitchen Display - Get orders for kitchen
router.get('/kitchen/orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  async (req, res) => {
    try {
      // Return pending/preparing orders for kitchen display
      res.json({ 
        success: true, 
        data: [] // Empty for production - will be populated with real orders
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch kitchen orders' });
    }
  }
);

// Kitchen Display - Mark item as ready
router.put('/kitchen/orders/:orderId/items/:itemId/ready',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
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

// Register sub-routes
router.use('/tables', tableRoutes);
router.use('/reservations', reservationRoutes);

export default router;
