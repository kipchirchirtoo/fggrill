import { Router, Request, Response } from 'express';
import {
  getPayrollSummary,
  calculatePayroll,
  processPayrollPayment,
  processBulkPayroll,
  getBanks,
  verifyBankAccount,
  generatePayslip
} from '../controllers/payroll.controller';
import { protect as authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get(
  '/summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  getPayrollSummary
);

router.post(
  '/calculate',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  calculatePayroll
);

router.post(
  '/pay',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  processPayrollPayment
);

router.post(
  '/bulk-pay',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  processBulkPayroll
);

// Get banks for payment setup
router.get('/banks', getBanks);

// Verify bank account
router.post('/verify-bank', verifyBankAccount);

// Generate payslip
router.get('/:id/payslip', generatePayslip);

export default router;
