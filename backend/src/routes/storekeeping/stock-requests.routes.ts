import express from 'express';
import { protect } from '../../middleware/auth';
import {
    getStockRequests,
    getStockRequest,
    createStockRequest,
    reviewStockRequest,
    approveStockRequest,
    rejectStockRequest,
    cancelStockRequest
} from '../../controllers/storekeeping/stock-requests.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Stock Requests routes
router.route('/')
    .get(getStockRequests)
    .post(createStockRequest);

router.route('/:id')
    .get(getStockRequest);

router.put('/:id/review', reviewStockRequest);
router.put('/:id/approve', approveStockRequest);
router.put('/:id/reject', rejectStockRequest);
router.put('/:id/cancel', cancelStockRequest);

export default router;
