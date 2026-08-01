import { Router } from 'express';
import {
    createCreditBill,
    getCreditBills,
    approveCreditBill,
    updateCreditBillStatus,
    triggerPendingBillsMigration,
    partialPayCreditBill,
    getCreditBillPayments,
    getCashierPaidCreditEntries,
    applyCashierPaidCreditEntry,
    getCreditBillContents,
    transferCreditBill,
    rejectCreditBill,
    editCreditBill
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
    getPayrollCreditBills,
    emailPayslips,
    downloadPayslipsZip,
    getPendingApprovals,
    approvePayrollItem,
    approvePayrollBatch,
    rejectPayrollItem
} from '../controllers/payroll-simple.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const creditAccountants = [
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.FINANCE_MANAGER,
    UserRole.AUDITOR
];

const router = Router();

router.use(protect);

// ==========================================
// CREDIT BILLS
// ==========================================
// Static paths MUST come before dynamic /:id routes
router.post('/credit-bills/migrate-pending', authorize(creditAccountants as any), triggerPendingBillsMigration);
router.get('/credit-bills/cashier-paid-credits', authorize(creditAccountants as any), getCashierPaidCreditEntries);
router.post('/credit-bills/cashier-paid-credits/:entryId/apply', authorize(creditAccountants as any), applyCashierPaidCreditEntry);
router.post('/credit-bills', authorize([...creditAccountants, UserRole.RECEPTIONIST, UserRole.RESTAURANT, UserRole.CASHIER] as any), createCreditBill);
router.get('/credit-bills', authorize([...creditAccountants, UserRole.EMPLOYEE, UserRole.HR_MANAGER] as any), getCreditBills);
router.get('/credit-bills/:id/contents', authorize(creditAccountants as any), getCreditBillContents);
router.post('/credit-bills/:id/transfer', authorize(creditAccountants as any), transferCreditBill);
router.patch('/credit-bills/:id/reject', authorize(creditAccountants as any), rejectCreditBill);
router.put('/credit-bills/:id', authorize(creditAccountants as any), editCreditBill);
router.patch('/credit-bills/:id/approve', authorize(creditAccountants as any), approveCreditBill);
router.patch('/credit-bills/:id', authorize(creditAccountants as any), updateCreditBillStatus);
router.post('/credit-bills/:id/partial-payment', authorize(creditAccountants as any), partialPayCreditBill);
router.get('/credit-bills/:id/payments', authorize(creditAccountants as any), getCreditBillPayments);

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
router.get('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), getPayrollCreditBills);
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
