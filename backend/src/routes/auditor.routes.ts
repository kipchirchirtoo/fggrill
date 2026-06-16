import express from 'express';
import {
  getAuditorDashboard,
  getAuditTools,
  startNightAudit,
  completeNightAudit,
  completeLatestNightAudit,
  getNightAuditStatus,
  getNightAudits,
  createException,
  resolveException,
  getExceptions,
  getAuditTrail,
  createAuditPlan,
  createFinding,
  getFindings,
  getSalesVerification,
  getFinancialReconciliation,
  getRevenueOversight,
  getInvoiceVerification,
  getCreditBillsForAudit,
  getAuditorDeliveriesAlias,
  getExpenditureVerification,
  getStockLevelsVerification,
  exportStockLedger,
  getBranchOrdersVerification,
  getSoldItemsAnalysis,
  exportSoldItemsAnalysisPDF,
  getBarStockAudits,
  verifyBarStockTake,
  getAnomalyDetail,
  verifyAnomaly,
  getDailyLogsStatus,
  verifyDailyLog,
  getStaffAudit,
  flagItem,
  getWatchlist,
  resolveWatchlistItem
} from '../controllers/auditor.controller';
import {
  getConsumptionConfigs,
  updateConsumptionConfig,
  getConsumptionVariances,
  submitApproval,
  getApprovalHistory,
  handleApprovalRequest,
  approvePendingRequest,
  rejectPendingRequest,
  getPayrollVariances,
  getPendingApprovals
} from '../controllers/auditor-advanced.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

// Dashboard / compatibility endpoints used by the Flutter auditor console.
router.get('/dashboard',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]),
  getAuditorDashboard
);

router.get('/audit-tools',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]),
  getAuditTools
);

// Night Audit
router.post('/night-audit/start',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  startNightAudit
);

router.put('/night-audit/:id/complete',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  completeNightAudit
);

router.get('/night-audit',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getNightAudits
);

router.get('/night-audit/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getNightAuditStatus
);

router.post('/night-audit/complete',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  completeLatestNightAudit
);

router.get('/night-audit/exceptions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getExceptions
);

// Exceptions
router.post('/exceptions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  createException
);

router.put('/exceptions/:id/resolve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  resolveException
);

router.get('/exceptions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getExceptions
);

router.get('/discrepancies',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getExceptions
);

// Audit Trail
router.get('/trail',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]),
  getAuditTrail
);

// Internal Audit
router.post('/plans',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createAuditPlan
);

router.post('/findings',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createFinding
);

router.get('/findings',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getFindings
);

// Advanced Operational Audit
router.get('/consumption/configs',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getConsumptionConfigs
);

router.post('/consumption/configs',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  updateConsumptionConfig
);

router.get('/consumption/variances',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getConsumptionVariances
);

// Approvals
router.post('/approvals',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  submitApproval
);

router.get('/approvals',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getApprovalHistory
);

router.get('/approvals/pending',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]),
  getPendingApprovals
);

router.post('/approvals/handle',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]),
  handleApprovalRequest
);

router.post('/approvals/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]),
  approvePendingRequest
);

router.post('/approvals/reject',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]),
  rejectPendingRequest
);

router.get('/payroll/variances',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getPayrollVariances
);

// MVP Modules
router.get('/verify/sales', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getSalesVerification);
router.get('/verify/finances', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getFinancialReconciliation);
router.get('/verify/revenue', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getRevenueOversight);
router.get('/revenue-checks', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getRevenueOversight);
router.get('/invoice-verification', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getInvoiceVerification);
router.get('/credit-bills', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getCreditBillsForAudit);
router.get('/deliveries', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT]), getAuditorDeliveriesAlias);
router.get('/verify/expenditure', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getExpenditureVerification);
router.get('/verify/stock-levels', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getStockLevelsVerification);
router.get('/verify/stock-levels/export', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), exportStockLedger);
router.post('/export/stock-ledger', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), exportStockLedger);
router.get('/verify/branch-orders', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getBranchOrdersVerification);
router.get('/verify/sold-items', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), getSoldItemsAnalysis);
router.get('/verify/sold-items/export/pdf', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), exportSoldItemsAnalysisPDF);
router.get('/verify/bar-stock', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getBarStockAudits);
router.post('/verify/bar-stock/:id/verify', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyBarStockTake);
router.get('/bar/stock-audits', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getBarStockAudits);
router.post('/bar/stock-audits/:id/verify', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyBarStockTake);
router.get('/verify/details', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getAnomalyDetail);
router.post('/verify/clear', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyAnomaly);

// Anomaly Detail Routes
router.get('/anomalies/:id', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getAnomalyDetail);
router.post('/anomalies/:id/clear', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyAnomaly);

// Daily Log Verification
router.get('/daily-logs', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT]), getDailyLogsStatus);
router.post('/daily-logs/:id/verify', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyDailyLog);

// Staff Audit
router.get('/staff-audit', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), getStaffAudit);

// Auditor Watchlist
router.post('/watchlist', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), flagItem);
router.get('/watchlist', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getWatchlist);
router.put('/watchlist/:id', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), resolveWatchlistItem);

export default router;
