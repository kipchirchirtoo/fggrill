import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
    getStaffAuditTrail,
    getCriticalActions,
    getStaffAuditSummary
} from '../controllers/staff-audit.controller';

const router = express.Router();

// All routes require authentication and specific roles
router.use(protect);
router.use(authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'));

// Get staff audit trail
router.get('/audit', getStaffAuditTrail);

// Get critical actions only
router.get('/audit/critical', getCriticalActions);

// Get audit summary for specific staff member
router.get('/:id/audit-summary', getStaffAuditSummary);

export default router;
