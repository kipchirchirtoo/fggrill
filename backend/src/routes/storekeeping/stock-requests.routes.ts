import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    getStockRequests,
    getStockRequest,
    getBranchPerformance,
    createStockRequest,
    reviewStockRequest,
    approveStockRequest,
    bulkApproveStockRequests,
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

router.get('/branch-performance/:branchId', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getBranchPerformance);

// Bulk approve route (must come before /:id routes)
router.post('/bulk-approve', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), bulkApproveStockRequests);

router.route('/:id')
    .get(getStockRequest);

router.put('/:id/review', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), reviewStockRequest);

// Strict Auditor Approval Workflow
router.put('/:id/approve', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), approveStockRequest);
router.put('/:id/reject', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), rejectStockRequest);

router.put('/:id/cancel', cancelStockRequest);

export default router;
