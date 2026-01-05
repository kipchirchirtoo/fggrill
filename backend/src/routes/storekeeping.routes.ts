import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import multer from 'multer';

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Import controllers
import {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  addStock,
  previewSKUEndpoint,
  getCategoriesEndpoint,
  generateSKUEndpoint,
  getStockHistory
} from '../controllers/storekeeping/items.controller';

import {
  getShopItems
} from '../controllers/storekeeping/shop.controller';

import {
  getTransferItems,
  transferItem,
  submitTransferRequest,
  completeTransfer
} from '../controllers/storekeeping/transfers.controller';

import {
  getAppConfig,
  getEditLockStatus,
  setEditLockStatus,
  exportDataExcel,
  importDataExcel
} from '../controllers/storekeeping/config.controller';

import {
  getBranchStock,
  getLowStockItems,
  recordStockOut,
  createStockRequest,
  getBranchRequests,
  getPendingRequests,
  reviewStockRequest,
  createDispatch,
  dispatchItems,
  getDispatchHistory,
  getIncomingDispatches,
  confirmDelivery,
  getCentralDashboard,
  getBranchDashboard,
  getBranchesWithStock,
  getMasterCatalog,
  getStockMovements
} from '../controllers/storekeeping/branch-inventory.controller';

import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getStockTakes,
  createStockTake,
  getStockTakeItems,
  updateStockTakeItem,
  completeStockTake
} from '../controllers/storekeeping/resources.controller';

import {
  getReceivedItems,
  createUsageRecord,
  recordUsageEntry,
  getUsageEntries,
  getBranchStaff,
  getStaffAccountability,
  getDailyUsageSummary,
  closeUsageRecord,
  getTrackableItems
} from '../controllers/storekeeping/kitchen-usage.controller';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Define authorized roles
const centralRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]; // Central warehouse management
const branchRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]; // Branch stock viewing
const allStoreRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]; // All storekeeping roles
const staffRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.RESTAURANT, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE];
const managerRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]; // Management level access

// =====================================================
// ITEMS ROUTES
// =====================================================

router.route('/items')
  .get(authorize(staffRoles), getItems)
  .post(authorize(managerRoles), createItem);

router.route('/items/:id')
  .get(authorize(staffRoles), getItem)
  .put(authorize(managerRoles), updateItem)
  .delete(authorize(managerRoles), deleteItem);

// Quick stock add endpoint (for Found mode)
router.post('/items/:id/add-stock', authorize(staffRoles), addStock);

// Stock history for an item
router.get('/items/:id/history', authorize(staffRoles), getStockHistory);

// =====================================================
// SKU GENERATION ROUTES
// =====================================================

// Get SKU categories list
router.get('/categories', authorize(staffRoles), getCategoriesEndpoint);

// Preview SKU without creating
router.post('/preview-sku', authorize(staffRoles), previewSKUEndpoint);

// Generate actual SKU
router.post('/generate-sku', authorize(staffRoles), generateSKUEndpoint);

// =====================================================
// SHOP ITEMS ROUTES
// =====================================================

router.get('/shop_items', authorize(staffRoles), getShopItems);

// =====================================================
// TRANSFER ROUTES
// =====================================================

router.get('/transfer_items', authorize(staffRoles), getTransferItems);

router.post('/transfer', authorize(staffRoles), transferItem);
router.post('/submit-transfer-request', authorize(staffRoles), submitTransferRequest);
router.post('/complete-transfer', authorize(managerRoles), completeTransfer);

// =====================================================
// CONFIG & UTILS ROUTES
// =====================================================

router.get('/app_config', authorize(staffRoles), getAppConfig);
router.get('/get_edit_lock_status', authorize(staffRoles), getEditLockStatus);
router.post('/set_edit_lock_status', authorize(managerRoles), setEditLockStatus);

router.get('/export_data', authorize(staffRoles), exportDataExcel);
router.post('/import_data', authorize(managerRoles), upload.single('file') as any, importDataExcel);

// =====================================================
// MULTI-BRANCH INVENTORY ROUTES
// =====================================================

// Master catalog (read-only for all, write for central)
router.get('/master-catalog', authorize(staffRoles), getMasterCatalog);

// Branch stock management
router.get('/branch-stock', authorize(branchRoles), getBranchStock);
router.get('/branch-stock/low', authorize(branchRoles), getLowStockItems);
router.post('/branch-stock/out', authorize(branchRoles), recordStockOut);
router.post('/branch-stock/adjustment', authorize(branchRoles), updateBranchStock);
router.get('/stock-movements', authorize(branchRoles), getStockMovements);

// Stock requests (Branch → Central)
router.post('/stock-requests', authorize(branchRoles), createStockRequest);
router.get('/stock-requests', authorize(branchRoles), getBranchRequests);
router.get('/stock-requests/pending', authorize(centralRoles), getPendingRequests);
router.put('/stock-requests/:id/review', authorize(centralRoles), reviewStockRequest);

// Dispatch notes (Central → Branch)
router.post('/dispatch-notes', authorize(centralRoles), createDispatch);
router.get('/dispatch-notes', authorize(centralRoles), getDispatchHistory);
router.put('/dispatch-notes/:id/dispatch', authorize(centralRoles), dispatchItems);

// Incoming dispatches (Branch receives)
router.get('/incoming-dispatches', authorize(branchRoles), getIncomingDispatches);
router.put('/dispatch-notes/:id/confirm', authorize(branchRoles), confirmDelivery);

// Dashboard routes
router.get('/dashboard/central', authorize(centralRoles), getCentralDashboard);
router.get('/dashboard/branch', authorize(branchRoles), getBranchDashboard);
router.get('/branches-stock', authorize(centralRoles), getBranchesWithStock);
router.get('/branches', authorize(staffRoles), getBranchesWithStock); // Alias for all staff

// =====================================================
// VEHICLES ROUTES
// =====================================================

router.route('/vehicles')
  .get(authorize(staffRoles), getVehicles)
  .post(authorize(managerRoles), createVehicle);

router.route('/vehicles/:id')
  .put(authorize(managerRoles), updateVehicle)
  .delete(authorize(managerRoles), deleteVehicle);

// =====================================================
// DRIVERS ROUTES
// =====================================================

router.route('/drivers')
  .get(authorize(staffRoles), getDrivers)
  .post(authorize(managerRoles), createDriver);

router.route('/drivers/:id')
  .put(authorize(managerRoles), updateDriver)
  .delete(authorize(managerRoles), deleteDriver);

// =====================================================
// SUPPLIERS ROUTES
// =====================================================

router.route('/suppliers')
  .get(authorize(staffRoles), getSuppliers)
  .post(authorize(managerRoles), createSupplier);

router.route('/suppliers/:id')
  .put(authorize(managerRoles), updateSupplier)
  .delete(authorize(managerRoles), deleteSupplier);

// =====================================================
// STOCK TAKES ROUTES
// =====================================================

router.route('/stock-takes')
  .get(authorize(staffRoles), getStockTakes)
  .post(authorize(managerRoles), createStockTake);

router.get('/stock-takes/:id/items', authorize(staffRoles), getStockTakeItems);
router.put('/stock-takes/:id/complete', authorize(managerRoles), completeStockTake);
router.put('/stock-take-items/:id', authorize(staffRoles), updateStockTakeItem);

// =====================================================
// KITCHEN USAGE TRACKING ROUTES
// =====================================================

// Get items that can be tracked (from branch stock)
router.get('/kitchen-usage/trackable-items', authorize(branchRoles), getTrackableItems);

// Get received items with usage tracking
router.get('/kitchen-usage', authorize(branchRoles), getReceivedItems);

// Create new usage tracking record
router.post('/kitchen-usage', authorize(branchRoles), createUsageRecord);

// Record usage entry (consumed, spoilt, lost, etc.)
router.post('/kitchen-usage/:usage_record_id/entries', authorize(branchRoles), recordUsageEntry);

// Get usage entries for a record
router.get('/kitchen-usage/:usage_record_id/entries', authorize(branchRoles), getUsageEntries);

// Close a usage record
router.put('/kitchen-usage/:usage_record_id/close', authorize(branchRoles), closeUsageRecord);

// Get branch staff for accountability
router.get('/kitchen-usage/staff', authorize(branchRoles), getBranchStaff);

// Get staff accountability report
router.get('/kitchen-usage/accountability', authorize(allStoreRoles), getStaffAccountability);

// Get daily usage summary
router.get('/kitchen-usage/summary', authorize(allStoreRoles), getDailyUsageSummary);

export default router;
