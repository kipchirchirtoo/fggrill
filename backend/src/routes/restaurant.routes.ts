import express from 'express';
import {
  getMenuCategories,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  createOrder,
  updateOrderStatus,
  getOrder,
  getOrders,
  getInventoryItems,
  updateInventoryStock
} from '../controllers/restaurant.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

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

export default router;
