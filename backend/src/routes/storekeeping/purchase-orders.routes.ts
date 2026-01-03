import express from 'express';
import { protect } from '../../middleware/auth';
import {
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    approvePurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder
} from '../../controllers/storekeeping/purchase-orders.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Purchase Orders routes
router.route('/')
    .get(getPurchaseOrders)
    .post(createPurchaseOrder);

router.route('/:id')
    .get(getPurchaseOrder);

router.put('/:id/approve', approvePurchaseOrder);
router.put('/:id/receive', receivePurchaseOrder);
router.put('/:id/cancel', cancelPurchaseOrder);

export default router;
