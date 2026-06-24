import express from 'express';
import { protect } from '../../middleware/auth';
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

const router = express.Router();

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

export default router;
