import { Router, Request, Response } from 'express';
import {
  getDraftPayroll,
  approvePayroll,
  addAdjustment,
  getAdjustments,
  getPayrollHistory,
  generatePayslip,
  downloadPayslipsZip,
  downloadSummaryPDF
} from '../controllers/payroll.controller';
import {
  createCreditBill,
  getCreditBills,
  updateCreditBillStatus,
  triggerPendingBillsMigration
} from '../controllers/credit-bills.controller';
import { getLoans, createLoan, approveLoan } from '../controllers/loans.controller';
import { getAdvances, createAdvance, approveAdvance } from '../controllers/advances.controller';
import { getPayrollSummary } from '../controllers/payroll-simple.controller';
import { protect as authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get current dynamic draft (creates one if it doesn't exist for the period)
router.get(
  '/draft',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  getDraftPayroll
);

// Get history of approved payroll runs
router.get(
  '/history',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  getPayrollHistory
);

// Get payroll summary stats
router.get(
  '/summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  getPayrollSummary
);

// Approve and lock a draft payroll run
router.post(
  '/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  approvePayroll
);

// Add a custom addition or deduction
router.post(
  '/adjustments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  addAdjustment
);

// Get additions/deductions for a specific staff member and period
router.get(
  '/adjustments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  getAdjustments
);

// Generate payslip PDF
router.get('/:id/payslip', generatePayslip);

// Download all payslips as ZIP for a run
router.get(
  '/run/:runId/payslips-zip',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  downloadPayslipsZip
);

// Download payroll summary PDF
router.get(
  '/run/:runId/summary-pdf',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  downloadSummaryPDF
);

// Credit Bills (Deductions from staff)
router.post(
  '/credit-bills',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.CASHIER, UserRole.AUDITOR]),
  createCreditBill
);

router.get(
  '/credit-bills',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getCreditBills
);

router.patch(
  '/credit-bills/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  updateCreditBillStatus
);

router.post(
  '/credit-bills/migrate-pending',
  authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  triggerPendingBillsMigration
);

// Staff Loans
router.get(
  '/loans',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.HR_MANAGER]),
  getLoans
);

router.post(
  '/loans',
  authorize([UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.ACCOUNTANT]),
  createLoan
);

router.patch(
  '/loans/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT]),
  approveLoan
);

// Staff Advances
router.get(
  '/advances',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.HR_MANAGER]),
  getAdvances
);

router.post(
  '/advances',
  authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.ACCOUNTANT]),
  createAdvance
);

router.patch(
  '/advances/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_MANAGER]),
  approveAdvance
);

export default router;
