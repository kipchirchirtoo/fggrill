import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
    getCashierClearances,
    getCashierShiftSummary,
    approveCashierClearance,
    flagCashierClearance,
    getShiftReconciliation,
    addShiftActualCollection,
    addShiftReconciliationExpense
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

// Shift reconciliation: accountant-verified collections + expenses
// (shift_actual_collections / shift_reconciliation_expenses)
router.get(
    '/clearances/:id/reconciliation',
    authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
    getShiftReconciliation
);

router.post(
    '/clearances/:id/actual-collections',
    authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN]),
    addShiftActualCollection
);

router.post(
    '/clearances/:id/reconciliation-expenses',
    authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN]),
    addShiftReconciliationExpense
);

export default router;
