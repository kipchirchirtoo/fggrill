import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  exportExceptionSummary,
  exportComplianceAudit,
  exportVoidAnalytics,
  exportRevenueReconciliation,
  exportLeakageReport,
  exportExpenditureAudit,
  exportStockVarianceReport,
  exportConsumptionAnalytics,
  exportGrnAudit,
  getBranchPerformanceReport,
  getStockUsageReport,
  getEmployeeCreditReport,
  exportStockMovement,
} from '../controllers/auditor-reports.controller';

const router = express.Router();
router.use(protect);
router.use(authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]));

// Named report exports
router.get('/export/exception_summary',       exportExceptionSummary);
router.get('/export/compliance_audit',        exportComplianceAudit);
router.get('/export/void_analytics',          exportVoidAnalytics);
router.get('/export/revenue_reconciliation',  exportRevenueReconciliation);
router.get('/export/leakage_report',          exportLeakageReport);
router.get('/export/expenditure_audit',       exportExpenditureAudit);
router.get('/export/variance_report',         exportStockVarianceReport);
router.get('/export/consumption_audit',       exportConsumptionAnalytics);
router.get('/export/grn_audit',               exportGrnAudit);
router.get('/export/stock_movement',          exportStockMovement);

// Legacy routes
router.get('/performance',     getBranchPerformanceReport);
router.get('/stock-usage',     getStockUsageReport);
router.get('/employee-credit', getEmployeeCreditReport);

export default router;
