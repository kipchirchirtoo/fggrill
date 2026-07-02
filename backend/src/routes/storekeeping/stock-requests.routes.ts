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
    cancelStockRequest,
    setItemIssueQty,
    confirmDispatch
} from '../../controllers/storekeeping/stock-requests.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Stock Requests routes
router.route('/')
    .get(getStockRequests)
    .post(createStockRequest);

router.get('/branch-performance/:branchId', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN]), getBranchPerformance);

// Bulk approve route (must come before /:id routes)
router.post('/bulk-approve', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), bulkApproveStockRequests);

router.route('/:id')
    .get(getStockRequest);

router.put('/:id/review', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), reviewStockRequest);

// Branch Accountant Approval Workflow (branch store requests go to branch accountant, then central store)
router.put('/:id/approve', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), approveStockRequest);
router.put('/:id/reject', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), rejectStockRequest);

router.put('/:id/cancel', cancelStockRequest);

// Central storekeeper: set per-item issue qty/status
router.patch('/:id/items/:itemId/issue', authorize([UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), setItemIssueQty);

// Central storekeeper: confirm dispatch (locks items, deducts stock, creates dispatch record)
router.post('/:id/confirm-dispatch', authorize([UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), confirmDispatch);

export default router;
