import express from 'express';
import {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  addStockMovement,
  getLowStockItems,
  getStockMovements,
  getInventoryStats,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliers,
  getSupplier,
  uploadItemPhotos
} from '../controllers/inventory.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { uploadService } from '../services/upload.service';

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// Staff routes
router.use(authorize([
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOUSEKEEPING,
  UserRole.MAINTENANCE,
  UserRole.RESTAURANT
]));

router.route('/items')
  .get(getItems)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createItem);

router.route('/items/:id')
  .get(getItem)
  .put(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateItem)
  .delete(authorize([UserRole.SUPER_ADMIN]), deleteItem);

router.post('/items/:id/movement', addStockMovement);
router.get('/items/:id/movements', getStockMovements);

router.post(
  '/items/:id/photos',
  uploadService.uploadMultiple('photos', 5),
  uploadItemPhotos
);

// Purchase Orders
router.route('/purchase-orders')
  .get(getPurchaseOrders)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createPurchaseOrder);

router.route('/purchase-orders/:id')
  .get(getPurchaseOrder)
  .put(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updatePurchaseOrder)
  .delete(authorize([UserRole.SUPER_ADMIN]), deletePurchaseOrder);

router.post(
  '/purchase-orders/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  approvePurchaseOrder
);

router.post(
  '/purchase-orders/:id/receive',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  receivePurchaseOrder
);

// Suppliers
router.route('/suppliers')
  .get(getSuppliers)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createSupplier);

router.route('/suppliers/:id')
  .get(getSupplier)
  .put(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateSupplier)
  .delete(authorize([UserRole.SUPER_ADMIN]), deleteSupplier);

// Stats routes - accessible by storekeepers too
router.get('/low-stock', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), getLowStockItems);
router.get('/stats/overview', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), getInventoryStats);

export default router;
