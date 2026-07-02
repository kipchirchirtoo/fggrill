import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import stockRequestsRoutes from './stock-requests.routes';
import dispatchNotesRoutes from './dispatch-notes.routes';
import purchaseOrdersRoutes from './purchase-orders.routes';
import resourcesRoutes from './resources.routes';
import itemsRoutes from './items.routes';
import openingStockRoutes from './opening-stock.routes';
import stockLedgerRoutes from './stock-ledger.routes';
import pastryProductionRoutes from './pastry-production.routes';
import nonSaleStockOutRoutes from './non-sale-stock-out.routes';
import barStocktakeRoutes from './bar-stocktake.routes';
import kitchenStocktakeRoutes from './kitchen-stocktake.routes';
import storeStocktakeRoutes from './store-stocktake.routes';
import branchSpoilageRoutes from './branch-spoilage.routes';
import { getWarehouseDashboard } from '../../controllers/storekeeping/dashboard.controller';
import {
  getBranchStock,
  getLowStockItems,
  getCentralDashboard,
  getBranchDashboard
} from '../../controllers/storekeeping/branch-inventory.controller';
import {
  createDirectIssue,
  getDirectIssues,
  getBackorders
} from '../../controllers/storekeeping/direct-issue.controller';

const router = express.Router();

const centralRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.AUDITOR];
const branchRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT];

router.use('/items', itemsRoutes);
router.use('/stock-requests', stockRequestsRoutes);
router.use('/dispatch-notes', dispatchNotesRoutes);
router.use('/purchase-orders', purchaseOrdersRoutes);
router.use('/opening-stock', openingStockRoutes);
router.use('/stock-ledger', stockLedgerRoutes);
router.use('/pastry-production', pastryProductionRoutes);
router.use('/non-sale-stock-out', nonSaleStockOutRoutes);
router.use('/bar-stocktake', barStocktakeRoutes);
router.use('/kitchen-stocktake', kitchenStocktakeRoutes);
router.use('/store-stocktake', storeStocktakeRoutes);
router.use('/spoilage', branchSpoilageRoutes);
router.use('/', resourcesRoutes);
router.get('/dashboard', protect, getWarehouseDashboard);
router.get('/dashboard/central', protect, getCentralDashboard);
router.get('/dashboard/branch', protect, getBranchDashboard);
router.get('/branch-stock', protect, getBranchStock);
router.get('/branch-stock/low', protect, getLowStockItems);

// Direct Issues (no prior requisition) — reuses stock_requests with request_type='DIRECT_ISSUE'
router.post('/direct-issues', protect, authorize(centralRoles), createDirectIssue);
router.get('/direct-issues', protect, authorize(branchRoles), getDirectIssues);

// Backorders — stock_request_items with issue_status='backordered'
router.get('/backorders', protect, authorize(branchRoles), getBackorders);

export default router;
