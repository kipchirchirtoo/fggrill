import { Router } from 'express';
import {
    createCreditBill,
    getCreditBills,
    updateCreditBillStatus,
    triggerPendingBillsMigration
} from '../controllers/credit-bills.controller';
import {
    createAdvance,
    getAdvances,
    approveAdvance
} from '../controllers/advances.controller';
import {
    createLoan,
    getLoans,
    approveLoan
} from '../controllers/loans.controller';
import {
    generatePayroll,
    getPayrollRecords,
    getPayrollSummary,
    emailPayslips,
    downloadPayslipsZip,
    getPendingApprovals,
    approvePayrollItem,
    rejectPayrollItem
} from '../controllers/payroll-simple.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(protect);

// ==========================================
// CREDIT BILLS
// ==========================================
router.post('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.RESTAURANT, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createCreditBill);
router.get('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE]), getCreditBills);
router.patch('/credit-bills/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), updateCreditBillStatus);
router.post('/credit-bills/migrate-pending', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), triggerPendingBillsMigration);

// ==========================================
// ADVANCES
// ==========================================
router.post('/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE]), createAdvance);
router.get('/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE]), getAdvances);
router.patch('/advances/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), approveAdvance);

// ==========================================
// LOANS
// ==========================================
router.post('/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createLoan);
router.get('/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE]), getLoans);
router.patch('/loans/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), approveLoan);

// ==========================================
// PAYROLL GENERATION
// ==========================================
router.post('/generate', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER]), generatePayroll);
router.get('/history', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.EMPLOYEE]), getPayrollRecords);
router.get('/summary', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER]), getPayrollSummary);
router.post('/email-all', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER]), emailPayslips);
router.post('/download-zip', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER]), downloadPayslipsZip);

// ==========================================
// AUDITOR APPROVAL
// ==========================================
router.get('/pending-approvals', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getPendingApprovals);
router.post('/:type/:id/approve', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), approvePayrollItem);
router.post('/:type/:id/reject', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), rejectPayrollItem);

export default router;
