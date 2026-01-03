import express from 'express';
import stockRequestsRoutes from './stock-requests.routes';
import dispatchNotesRoutes from './dispatch-notes.routes';
import purchaseOrdersRoutes from './purchase-orders.routes';
import resourcesRoutes from './resources.routes';
import { getWarehouseDashboard } from '../../controllers/storekeeping/dashboard.controller';

const router = express.Router();

router.use('/stock-requests', stockRequestsRoutes);
router.use('/dispatch-notes', dispatchNotesRoutes);
router.use('/purchase-orders', purchaseOrdersRoutes);
router.use('/', resourcesRoutes);
router.get('/dashboard', getWarehouseDashboard);

export default router;
