import { Router } from 'express';
import {
    createCreditBill,
    getCreditBills,
    updateCreditBillStatus,
    triggerPendingBillsMigration,
    partialPayCreditBill,
    getCreditBillPayments
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
    approvePayrollBatch,
    rejectPayrollItem
} from '../controllers/payroll-simple.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(protect);

// ==========================================
// CREDIT BILLS
// ==========================================
// Static paths MUST come before dynamic /:id routes
router.post('/credit-bills/migrate-pending', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), triggerPendingBillsMigration);
router.post('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.RESTAURANT, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createCreditBill);
router.get('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.HR_MANAGER]), getCreditBills);
router.patch('/credit-bills/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), updateCreditBillStatus);
router.post('/credit-bills/:id/partial-payment', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), partialPayCreditBill);
router.get('/credit-bills/:id/payments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getCreditBillPayments);

// ==========================================
// ADVANCES
// ==========================================
router.post('/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE]), createAdvance);
router.get('/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.HR_MANAGER]), getAdvances);
router.patch('/advances/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), approveAdvance);

// ==========================================
// LOANS
// ==========================================
router.post('/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createLoan);
router.get('/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.HR_MANAGER]), getLoans);
router.patch('/loans/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), approveLoan);

// ==========================================
// PAYROLL GENERATION
// ==========================================
router.post('/generate', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), generatePayroll);
router.get('/history', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.EMPLOYEE, UserRole.AUDITOR]), getPayrollRecords);
router.get('/summary', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), getPayrollSummary);
router.post('/email-all', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), emailPayslips);
router.post('/download-zip', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), downloadPayslipsZip);

// ==========================================
// AUDITOR APPROVAL
// ==========================================
router.get('/pending-approvals', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getPendingApprovals);
router.post('/approve-batch', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), approvePayrollBatch);
router.post('/:type/:id/approve', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), approvePayrollItem);
router.post('/:type/:id/reject', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), rejectPayrollItem);

export default router;
