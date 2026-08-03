import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { optionalIdempotency } from '../middleware/idempotency';
import { UserRole } from '../models/User';
import { validateModuleAccess, enforceBranchScoping, SourceModule } from '../middleware/moduleAccess';
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
  getStockHistory,
  generateBarcodeEndpoint,
  getCentralValuation
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
  getPendingRequests,
  createDispatch,
  dispatchItems,
  getDispatchHistory,
  getIncomingDispatches,
  confirmDelivery,
  getCentralDashboard,
  getBranchDashboard,
  getBranchesWithStock,
  getMasterCatalog,
  getStockMovements,
  updateBranchStock,
  updateDispatchLogistics,
  createBranchTransfer,
  getOutgoingBranchTransfers,
  getIncomingBranchTransfers,
  confirmBranchTransferReceipt
} from '../controllers/storekeeping/branch-inventory.controller';

import {
  receiveFromSupplier
} from '../controllers/storekeeping/branch-receipt.controller';

import {
  getStockRequests,
  getStockRequest,
  createStockRequest,
  reviewStockRequest,
  approveStockRequest,
  rejectStockRequest,
  getBranchPerformance,
  getApprovedRequests,
  setItemIssueQty,
  confirmDispatch
} from '../controllers/storekeeping/stock-requests.controller';

import {
  createDirectIssue,
  getDirectIssues,
  getBackorders
} from '../controllers/storekeeping/direct-issue.controller';

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
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getStockTakes,
  getStockTake,
  createStockTake,
  getStockTakeItems,
  updateStockTakeItem,
  updateStockTake,
  completeStockTake
} from '../controllers/storekeeping/resources.controller';

import {
  getCentralStockTakes,
  getCentralStockTake,
  createCentralStockTake,
  updateCentralStockTake,
  submitCentralStockTake,
  approveCentralStockTake,
  rejectCentralStockTake,
  generateCentralStockTakeWorksheetPDF,
  generateCentralStockTakeExcel
} from '../controllers/storekeeping/central-stock-take.controller';

import {
  getSpoilageRecords,
  getSpoilageSummary,
  getSpoilageItems,
  createSpoilageRecord,
  updateSpoilageStatus,
  getSpoilageRecord
} from '../controllers/storekeeping/central-spoilage.controller';

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

import {
  finalizeStockTakeByAuditor,
  getDepartmentConsumption,
  getDepartmentAccounts,
  createDepartmentRequestLog,
  getDepartmentIssueJournalDetail,
  getDepartmentIssueJournals,
  getDepartmentRequestLog,
  getDepartmentRequestLogs,
  getEnterpriseInventoryAnalytics,
  getInventoryAuditLog,
  issueDepartmentRequestLog,
  listPosInventoryMappings,
  recordDepartmentIssue,
  reviewStockTakeByAccountant,
  seedDepartmentAccounts,
  submitStockTakeToAccountant,
  upsertPosInventoryMapping
} from '../controllers/storekeeping/enterprise-inventory.controller';

import {
  convertStock,
  getYieldRules
} from '../controllers/storekeeping/conversions.controller';

import {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder
} from '../controllers/storekeeping/purchase-orders.controller';

import {
  exportStockLedger
} from '../controllers/auditor.controller';

import {
  printDepartmentRequestDocument,
  printDispatchDocument,
  printMaterialIssueDocument,
  printStockRequestDocument
} from '../controllers/inventory-workflow-documents.controller';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Define authorized roles
const centralRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.AUDITOR]; // Central warehouse management
const branchRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]; // Branch stock viewing
const allStoreRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]; // All storekeeping roles
const staffRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.RESTAURANT,
  UserRole.HOUSEKEEPING,
  UserRole.MAINTENANCE,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.AUDITOR
];
const managerRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.AUDITOR
]; // Management level access

const accountantRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT
];
const stockTakeOwnerRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.BRANCH_MANAGER
];

const auditorRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR];
const branchAccountantRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_ACCOUNTANT];

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

// Generate barcode
router.post('/generate-barcode', authorize(managerRoles), generateBarcodeEndpoint);

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
// STOCK CONVERSION ROUTES (Yield Control)
// =====================================================

router.post('/conversions', authorize(staffRoles), convertStock);
router.get('/yield-rules', authorize(staffRoles), getYieldRules);

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
router.post(
  '/branch-stock/receive-supplier',
  authorize(branchRoles),
  optionalIdempotency({ scope: 'store.receive-supplier' }),
  receiveFromSupplier,
);
router.get('/stock-movements', authorize(branchRoles), getStockMovements);
router.post('/stock-ledger/export', authorize(branchRoles), exportStockLedger);

// Enterprise inventory controls
router.get('/department-accounts', authorize(branchRoles), getDepartmentAccounts);
router.post('/department-accounts/seed', authorize(managerRoles), seedDepartmentAccounts);
router.post(
  '/department-issues',
  authorize(branchRoles),
  optionalIdempotency({ scope: 'store.department-issues' }),
  recordDepartmentIssue,
);
router.post('/department-requests', authorize(branchRoles), createDepartmentRequestLog);
router.get('/department-requests', authorize(branchRoles), getDepartmentRequestLogs);
router.get('/department-requests/:id/request.pdf', authorize(branchRoles), printDepartmentRequestDocument);
router.post(
  '/department-requests/:id/issue',
  authorize(branchRoles),
  optionalIdempotency({ scope: 'store.department-request-issue' }),
  issueDepartmentRequestLog,
);
router.get('/department-requests/:id', authorize(branchRoles), getDepartmentRequestLog);
router.get('/department-consumption', authorize(branchRoles), getDepartmentConsumption);
router.get('/department-issue-journals', authorize(branchRoles), getDepartmentIssueJournals);
router.get('/department-issue-journals/:id/min.pdf', authorize(branchRoles), printMaterialIssueDocument);
router.get('/department-issue-journals/:id', authorize(branchRoles), getDepartmentIssueJournalDetail);
router.get('/enterprise-inventory/analytics', authorize(branchRoles), getEnterpriseInventoryAnalytics);
router.get('/enterprise-inventory/audit-log', authorize(auditorRoles), getInventoryAuditLog);
router.get('/pos-inventory-mappings', authorize(managerRoles), listPosInventoryMappings);
router.put('/pos-inventory-mappings', authorize(managerRoles), upsertPosInventoryMapping);

// Stock requests (Branch → Central)
// IMPORTANT: Specific routes MUST come before parameterized routes
router.get('/stock-requests/approved', authorize(centralRoles), getApprovedRequests);
router.get('/stock-requests/pending', authorize(managerRoles), getPendingRequests); // Allow branch managers to see pending requests
router.get('/stock-requests/branch-performance/:branchId', authorize(branchAccountantRoles), getBranchPerformance);
router.post(
  '/stock-requests',
  authorize(branchRoles),
  optionalIdempotency({ scope: 'store.stock-requests' }),
  createStockRequest,
);
router.get('/stock-requests', authorize(branchRoles), getStockRequests);
router.get('/stock-requests/:id/:document(request|approval).pdf', authorize(branchRoles), printStockRequestDocument);
router.get('/stock-requests/:id', authorize(branchRoles), getStockRequest);
router.put('/stock-requests/:id/review', authorize(branchAccountantRoles), reviewStockRequest);
router.put('/stock-requests/:id/approve', authorize(branchAccountantRoles), approveStockRequest);
router.put('/stock-requests/:id/reject', authorize(branchAccountantRoles), rejectStockRequest);

// Per-item issue quantity (central storekeeper)
router.patch('/stock-requests/:id/items/:itemId/issue', authorize(centralRoles), setItemIssueQty);

// Confirm dispatch (central storekeeper)
router.post(
  '/stock-requests/:id/confirm-dispatch',
  authorize(centralRoles),
  optionalIdempotency({ scope: 'store.stock-request-dispatch' }),
  confirmDispatch,
);

// Direct Issues
router.post(
  '/direct-issues',
  authorize(centralRoles),
  optionalIdempotency({ scope: 'store.direct-issues' }),
  createDirectIssue,
);
router.get('/direct-issues', authorize(branchRoles), getDirectIssues);

// Backorders
router.get('/backorders', authorize(branchRoles), getBackorders);

// Dispatch notes (Central → Branch)
router.post('/dispatch-notes', authorize(centralRoles), createDispatch);
router.get('/dispatch-notes', authorize(centralRoles), getDispatchHistory);
router.get('/dispatch-notes/:id/:document(packing|dispatch|receipt).pdf', authorize(branchRoles), printDispatchDocument);
router.put(
  '/dispatch-notes/:id/dispatch',
  authorize(centralRoles),
  optionalIdempotency({ scope: 'store.dispatch-send' }),
  dispatchItems,
);
router.put('/dispatch-notes/:id/logistics', authorize(centralRoles), updateDispatchLogistics);

// Incoming dispatches (Branch receives)
router.get('/incoming-dispatches', authorize(branchRoles), getIncomingDispatches);
router.put(
  '/dispatch-notes/:id/confirm',
  authorize(branchRoles),
  optionalIdempotency({ scope: 'store.dispatch-confirm' }),
  confirmDelivery,
);

// Branch transfers (Branch → Branch)
router.post(
  '/branch-transfers',
  authorize(branchRoles),
  optionalIdempotency({ scope: 'store.branch-transfers' }),
  createBranchTransfer,
);
router.get('/branch-transfers/outgoing', authorize(branchRoles), getOutgoingBranchTransfers);
router.get('/branch-transfers/incoming', authorize(branchRoles), getIncomingBranchTransfers);
router.put(
  '/branch-transfers/:id/confirm',
  authorize(branchRoles),
  optionalIdempotency({ scope: 'store.branch-transfer-confirm' }),
  confirmBranchTransferReceipt,
);

// Dashboard routes
router.get('/dashboard/central', authorize(centralRoles), getCentralDashboard);
router.get('/dashboard/branch', authorize(branchRoles), getBranchDashboard);
router.get('/branches-stock', authorize(centralRoles), getBranchesWithStock);
router.get('/branches', authorize(staffRoles), getBranchesWithStock); // Alias for all staff
router.get('/valuation', authorize(centralRoles), getCentralValuation);

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

const driverManagerRoles = [...managerRoles, UserRole.HR_MANAGER];
const driverStaffRoles = [...staffRoles, UserRole.HR_MANAGER];

router.route('/drivers')
  .get(authorize(driverStaffRoles), getDrivers)
  .post(authorize(driverManagerRoles), createDriver);

router.route('/drivers/:id')
  .put(authorize(driverManagerRoles), updateDriver)
  .delete(authorize(driverManagerRoles), deleteDriver);

// =====================================================
// SUPPLIERS ROUTES
// =====================================================

router.route('/suppliers')
  .get(authorize(staffRoles), getSuppliers)
  .post(authorize(managerRoles), createSupplier);

router.route('/suppliers/:id')
  .get(authorize(staffRoles), getSupplier)
  .put(authorize(managerRoles), updateSupplier)
  .delete(authorize(managerRoles), deleteSupplier);

// =====================================================
// STOCK TAKES ROUTES
// =====================================================

router.route('/stock-takes')
  .get(authorize(staffRoles), getStockTakes)
  .post(authorize(stockTakeOwnerRoles), optionalIdempotency({ scope: 'store.stock-takes' }), createStockTake);

router.get('/stock-takes/:id', authorize(staffRoles), getStockTake);
router.put('/stock-takes/:id', authorize(stockTakeOwnerRoles), optionalIdempotency({ scope: 'store.stock-take-update' }), updateStockTake);
router.get('/stock-takes/:id/items', authorize(staffRoles), getStockTakeItems);
router.put('/stock-takes/:id/complete', authorize(stockTakeOwnerRoles), optionalIdempotency({ scope: 'store.stock-take-complete' }), completeStockTake);
router.post('/stock-takes/:id/submit-accountant', authorize(stockTakeOwnerRoles), optionalIdempotency({ scope: 'store.stock-take-submit-accountant' }), submitStockTakeToAccountant);
router.post('/stock-takes/:id/accountant-review', authorize(accountantRoles), reviewStockTakeByAccountant);
router.post('/stock-takes/:id/auditor-finalize', authorize(auditorRoles), finalizeStockTakeByAuditor);
router.put('/stock-take-items/:id', authorize(staffRoles), updateStockTakeItem);

// =====================================================
// CENTRAL STORE STOCK TAKES (Foodstuffs vs Bar Store)
// =====================================================

router.route('/central-stock-takes')
  .get(authorize(staffRoles), getCentralStockTakes)
  .post(authorize(managerRoles), createCentralStockTake);

router.get('/central-stock-takes/:id', authorize(staffRoles), getCentralStockTake);
router.put('/central-stock-takes/:id', authorize(managerRoles), updateCentralStockTake);
router.post('/central-stock-takes/:id/submit', authorize(managerRoles), submitCentralStockTake);
router.post('/central-stock-takes/:id/approve', authorize(auditorRoles), approveCentralStockTake);
router.post('/central-stock-takes/:id/reject', authorize(auditorRoles), rejectCentralStockTake);
router.get('/central-stock-takes/:id/worksheet-pdf', authorize(staffRoles), generateCentralStockTakeWorksheetPDF);
router.get('/central-stock-takes/:id/excel', authorize(staffRoles), generateCentralStockTakeExcel);

// =====================================================
// CENTRAL STORE SPOILAGE LOG ROUTES
// =====================================================

router.get('/central-spoilage', authorize(staffRoles), getSpoilageRecords);
router.get('/central-spoilage/summary', authorize(staffRoles), getSpoilageSummary);
router.get('/central-spoilage/items', authorize(staffRoles), getSpoilageItems);
router.post('/central-spoilage', authorize(managerRoles), createSpoilageRecord);
router.get('/central-spoilage/:id', authorize(staffRoles), getSpoilageRecord);
router.patch('/central-spoilage/:id/status', authorize(auditorRoles), optionalIdempotency({ scope: 'store.central-spoilage-status' }), updateSpoilageStatus);

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

// =====================================================
// PURCHASE ORDERS ROUTES
// =====================================================
// PURCHASE ORDERS (Branch Store Module)
// =====================================================

router.route('/purchase-orders')
  .get(
    authorize(allStoreRoles), 
    validateModuleAccess([SourceModule.BRANCH_STORE]),
    enforceBranchScoping,
    getPurchaseOrders
  )
  .post(
    authorize(managerRoles), 
    validateModuleAccess([SourceModule.BRANCH_STORE]),
    enforceBranchScoping,
    createPurchaseOrder
  );

router.route('/purchase-orders/:id')
  .get(
    authorize(allStoreRoles), 
    validateModuleAccess([SourceModule.BRANCH_STORE]),
    enforceBranchScoping,
    getPurchaseOrder
  )
  .put(
    authorize(managerRoles), 
    validateModuleAccess([SourceModule.BRANCH_STORE]),
    enforceBranchScoping,
    updatePurchaseOrder
  )
  .delete(
    authorize(managerRoles), 
    validateModuleAccess([SourceModule.BRANCH_STORE]),
    enforceBranchScoping,
    deletePurchaseOrder
  );

router.put('/purchase-orders/:id/approve', 
  authorize(managerRoles), 
  validateModuleAccess([SourceModule.BRANCH_STORE]),
  enforceBranchScoping,
  approvePurchaseOrder
);

router.post('/purchase-orders/:id/approve', 
  authorize(managerRoles), 
  validateModuleAccess([SourceModule.BRANCH_STORE]),
  enforceBranchScoping,
  approvePurchaseOrder
);

router.put('/purchase-orders/:id/receive', 
  authorize(managerRoles), 
  validateModuleAccess([SourceModule.BRANCH_STORE]),
  enforceBranchScoping,
  receivePurchaseOrder
);

router.post('/purchase-orders/:id/receive', 
  authorize(managerRoles), 
  validateModuleAccess([SourceModule.BRANCH_STORE]),
  enforceBranchScoping,
  receivePurchaseOrder
);

router.put('/purchase-orders/:id/cancel', 
  authorize(managerRoles), 
  validateModuleAccess([SourceModule.BRANCH_STORE]),
  enforceBranchScoping,
  cancelPurchaseOrder
);

router.post('/purchase-orders/:id/cancel', 
  authorize(managerRoles), 
  validateModuleAccess([SourceModule.BRANCH_STORE]),
  enforceBranchScoping,
  cancelPurchaseOrder
);

export default router;
