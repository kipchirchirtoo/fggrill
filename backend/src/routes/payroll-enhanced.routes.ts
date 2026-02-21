import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getDeductionRates,
  updateDeductionRate,
  calculatePayroll,
  processEnhancedPayroll,
  updateEnhancedPayroll,
  getEnhancedPayroll,
  generatePayslip,
  bulkProcessPayroll
} from '../controllers/payroll-enhanced.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Deduction rates routes
router.get('/deduction-rates', authorize('hr_manager', 'super_admin', 'accountant'), getDeductionRates);
router.put('/deduction-rates/:id', authorize('hr_manager', 'super_admin'), updateDeductionRate);

// Payroll calculation
router.post('/calculate', authorize('hr_manager', 'super_admin', 'accountant'), calculatePayroll);

// Payroll processing
router.get('/', authorize('hr_manager', 'super_admin', 'accountant'), getEnhancedPayroll);
router.post('/', authorize('hr_manager', 'super_admin'), processEnhancedPayroll);
router.post('/bulk', authorize('hr_manager', 'super_admin'), bulkProcessPayroll);
router.put('/:id', authorize('hr_manager', 'super_admin'), updateEnhancedPayroll);

// Payslip generation
router.get('/:id/payslip', authorize('hr_manager', 'super_admin', 'accountant'), generatePayslip);

export default router;
