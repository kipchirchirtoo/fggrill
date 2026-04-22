import express from 'express';
import { protect } from '../../middleware/auth';
import stockRequestsRoutes from './stock-requests.routes';
import dispatchNotesRoutes from './dispatch-notes.routes';
import purchaseOrdersRoutes from './purchase-orders.routes';
import resourcesRoutes from './resources.routes';
import itemsRoutes from './items.routes';
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
router.use('/', resourcesRoutes);
router.get('/dashboard', protect, getWarehouseDashboard);
router.get('/dashboard/central', protect, getCentralDashboard);
router.get('/dashboard/branch', protect, getBranchDashboard);
router.get('/branch-stock', protect, getBranchStock);
router.get('/branch-stock/low', protect, getLowStockItems);

export default router;
