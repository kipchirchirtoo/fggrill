import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
    getStaffAuditTrail,
    getCriticalActions,
    getStaffAuditSummary,
    getBranchWaiters,
    getWaiterOrders
} from '../controllers/staff-audit.controller';

const router = express.Router();

// Get staff audit trail
router.get('/audit', protect, authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'), getStaffAuditTrail);

// Get critical actions only
router.get('/audit/critical', protect, authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'), getCriticalActions);

// Waiter audit endpoints
router.get('/audit/waiters', protect, authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'), getBranchWaiters);
router.get('/audit/waiters/:waiterId/orders', protect, authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'), getWaiterOrders);

// Get audit summary for specific staff member
router.get('/:id/audit-summary', protect, authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'), getStaffAuditSummary);

export default router;
