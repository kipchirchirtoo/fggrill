import { Router, Request, Response } from 'express';
import {
  getPayrollSummary,
  calculatePayroll,
  processPayrollPayment,
  processBulkPayroll,
  getBanks,
  verifyBankAccount
} from '../controllers/payroll.controller';
import { protect as authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get(
  '/summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  getPayrollSummary
);

router.post(
  '/calculate',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  calculatePayroll
);

router.post(
  '/pay',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  processPayrollPayment
);

router.post(
  '/bulk-pay',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  processBulkPayroll
);

// Get banks for payment setup
router.get('/banks', getBanks);

// Verify bank account
router.post('/verify-bank', verifyBankAccount);

export default router;
