import { Router } from 'express';
import {
    createCreditBill,
    getCreditBills,
    updateCreditBillStatus
} from '../controllers/credit-bills.controller';
import {
    createAdvance,
    getAdvances,
    approveAdvance
} from '../controllers/advances.controller';
import {
    createLoan,
    getLoans
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
router.post('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.RESTAURANT]), createCreditBill);
router.get('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.EMPLOYEE]), getCreditBills);
router.patch('/credit-bills/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT]), updateCreditBillStatus);

// ==========================================
// ADVANCES
// ==========================================
router.post('/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.EMPLOYEE]), createAdvance);
router.get('/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.EMPLOYEE]), getAdvances);
router.patch('/advances/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT]), approveAdvance);

// ==========================================
// LOANS
// ==========================================
router.post('/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT]), createLoan);
router.get('/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.EMPLOYEE]), getLoans);

// ==========================================
// PAYROLL GENERATION
// ==========================================
router.post('/generate', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER]), generatePayroll);
router.get('/history', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER, UserRole.EMPLOYEE]), getPayrollRecords);
router.get('/summary', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER]), getPayrollSummary);
router.post('/email-all', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER]), emailPayslips);
router.post('/download-zip', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER]), downloadPayslipsZip);

// ==========================================
// AUDITOR APPROVAL
// ==========================================
router.get('/pending-approvals', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getPendingApprovals);
router.post('/:type/:id/approve', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), approvePayrollItem);
router.post('/:type/:id/reject', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), rejectPayrollItem);

export default router;
