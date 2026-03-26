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

export default router;
