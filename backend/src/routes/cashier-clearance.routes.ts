import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
    getCashierClearances,
    getCashierShiftSummary,
    approveCashierClearance,
    flagCashierClearance
} from '../controllers/cashier-clearance.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Cashier clearance routes
router.get(
    '/clearances',
    authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
    getCashierClearances
);

router.get(
    '/:id/shift-summary',
    authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
    getCashierShiftSummary
);

router.post(
    '/clearances/:id/approve',
    authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
    approveCashierClearance
);

router.post(
    '/clearances/:id/flag',
    authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
    flagCashierClearance
);

export default router;
