import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
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

// Strict Auditor Approval Workflow
router.put('/:id/approve', authorize([UserRole.AUDITOR]), approveStockRequest);
router.put('/:id/reject', authorize([UserRole.AUDITOR]), rejectStockRequest);

router.put('/:id/cancel', cancelStockRequest);

export default router;
