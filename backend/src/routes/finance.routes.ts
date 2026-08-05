import express from "express";
import {
  getTransactions,
  createTransaction,
  getInvoices,
  createInvoice,
  processPayment,
  getFinancialOverview,
  getBudgets,
  createBudget,
  getExpenses,
  createExpense,
  approveExpense,
  getCashFlowReport,
  getProfitLossStatement,
  getRevenueByBranch,
  getBudgetAnalysis,
  getTaxSummary,
  getFinancialForecast,
  getAccountsReceivablePayable,
  getFinancialKPIs,
  getBranchFinancialProfile,
  getDailyLogs,
  saveDailyLog,
  updateDailyLogStatus,
} from "../controllers/finance.controller";
import {
  getDailyRecords,
  getDailyRecordByDate,
  saveDailyRecord,
  getDailyAutofill,
  getMonthlyAdjustments,
  saveMonthlyAdjustment,
  exportMonthlyStatement,
} from "../controllers/financial-workspace.controller";
import {
  submitWorkspaceClose,
  submitVarianceExplanation,
  postWorkspaceSubmission,
  getWorkspaceSubmissions,
  getWorkspaceSubmission,
  reviewWorkspaceSubmission,
  getAuditReviewQueue,
  getDailySnapshot,
  getBranchProfitability,
} from "../controllers/financial-close.controller";
import { getComprehensiveDailyData } from "../controllers/lina-comprehensive-fetch.controller";
import {
  listPayrollBatches,
  getPayrollBatch,
  generatePayrollBatch,
  submitPayrollBatch,
  reviewPayrollBatch,
  approvePayrollBatch,
  getDirectorPayrollSummary,
  downloadPayrollBatchPdf,
  downloadBatchPayslipsZip,
} from "../controllers/branch-payroll.controller";
import {
  getStaffPosAccountingSummary,
  getStaffPosAccountingOrders,
  getPosDeepDrillOrders,
} from "../controllers/branch-pos-staff-accounting.controller";
import { DirectorController } from "../controllers/director.controller";
import { DirectorEnhancedController } from "../controllers/director-enhanced.controller";
import { DirectorTasksController } from "../controllers/director-tasks.controller";
import { DiscrepancyController } from "../controllers/discrepancies.controller";
import { getDiscrepancyAggregate } from "../controllers/discrepancy-aggregate.controller";
import { protect, authorize } from "../middleware/auth";
import { UserRole } from "../models/User";
import { supabase } from "../config/database";

const router = express.Router();

// Public/unauthenticated routes
router.get("/branches", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, code");
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error("Get branches error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply authentication to all other routes
router.use(protect);

// Guest and staff routes
router.get(
  "/invoices/:id",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.RECEPTIONIST,
  ]),
  getInvoices,
);

// Staff routes
router.get(
  "/invoices",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.RECEPTIONIST,
  ]),
  getInvoices,
);

router.post(
  "/payments",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.RECEPTIONIST,
  ]),
  processPayment,
);

// Finance staff routes
router.get(
  "/transactions",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getTransactions,
);

router.post(
  "/transactions",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  createTransaction,
);

router.post(
  "/invoices",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  createInvoice,
);

router.get(
  "/overview",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getFinancialOverview,
);

// Dashboard alias for overview
router.get(
  "/dashboard",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.BRANCH_MANAGER,
  ]),
  getFinancialOverview,
);

router
  .route("/budgets")
  .get(
    authorize([
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.BRANCH_ACCOUNTANT,
    ]),
    getBudgets,
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
    createBudget,
  );

router
  .route("/expenses")
  .get(
    authorize([
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.BRANCH_ACCOUNTANT,
    ]),
    getExpenses,
  )
  .post(
    authorize([
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.BRANCH_ACCOUNTANT,
      UserRole.CENTRAL_STOREKEEPER,
      UserRole.BRANCH_STOREKEEPER,
    ]),
    createExpense,
  );

router.put(
  "/expenses/:id/approve",
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  approveExpense,
);

// ============== DAILY LOG SYSTEM ==============
router.get(
  "/daily-logs",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR,
  ]),
  getDailyLogs,
);

router.post(
  "/daily-logs",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  saveDailyLog,
);

router.put(
  "/daily-logs/:id/status",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR,
  ]),
  updateDailyLogStatus,
);

// ============== FINANCIAL WORKSPACE ==============

router.get(
  "/workspace/daily",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR,
  ]),
  getDailyRecords,
);

// Lina AI auto-fill — must be registered BEFORE '/workspace/daily/:date'
// so it isn't captured as a date param.
router.get(
  "/workspace/daily/autofill",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.DIRECTOR,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.BRANCH_MANAGER,
  ]),
  getDailyAutofill,
);

// ═══════════════════════════════════════════════════════════════════════════════
// LINA AI COMPREHENSIVE DATA FETCH
// Fetches ALL payment, cashier, and shift data from 16+ database tables
// ═══════════════════════════════════════════════════════════════════════════════
router.get(
  "/lina/comprehensive-fetch",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.AUDITOR,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
  ]),
  getComprehensiveDailyData,
);

router.get(
  "/workspace/daily/:date",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR,
  ]),
  getDailyRecordByDate,
);

router.post(
  "/workspace/daily",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  saveDailyRecord,
);

router.get(
  "/workspace/monthly",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR,
  ]),
  getMonthlyAdjustments,
);

router.post(
  "/workspace/monthly",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  saveMonthlyAdjustment,
);

router.get(
  "/workspace/export",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.DIRECTOR,
  ]),
  exportMonthlyStatement,
);

// ============== ADVANCED FINANCIAL TOOLS ==============

// Cash Flow Report
router.get(
  "/cashflow",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getCashFlowReport,
);

// Profit & Loss Statement
router.get(
  "/profit-loss",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR,
  ]),
  getProfitLossStatement,
);

// Revenue by Branch
router.get(
  "/revenue-by-branch",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getRevenueByBranch,
);

// Budget vs Actual Analysis
router.get(
  "/budget-analysis",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getBudgetAnalysis,
);

// Tax Summary
router.get(
  "/tax-summary",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getTaxSummary,
);

// Financial Forecast
router.get(
  "/forecast",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getFinancialForecast,
);

// Accounts Receivable/Payable
router.get(
  "/ar-ap",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getAccountsReceivablePayable,
);

// Financial KPIs
router.get(
  "/kpis",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getFinancialKPIs,
);

// Unified Branch Financials
router.get(
  "/branch-financials/:branchId",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getBranchFinancialProfile,
);

// ============== ADVANCED ACCOUNTING FEATURES ==============

// Balance Sheet
router.get(
  "/balance-sheet",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      // Proxy to Python service or implement locally
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.get(
        `${pythonUrl}/api/finance/balance-sheet`,
        { params: req.query },
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Balance sheet error:", error.message);
      res.json({
        success: true,
        data: { total_assets: 0, total_liabilities: 0, equity: { total: 0 } },
      });
    }
  },
);

// Trial Balance
router.get(
  "/trial-balance",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.get(
        `${pythonUrl}/api/finance/trial-balance`,
        { params: req.query },
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Trial balance error:", error.message);
      res.json({
        success: true,
        data: {
          entries: [],
          total_debit: 0,
          total_credit: 0,
          is_balanced: true,
        },
      });
    }
  },
);

// Journal Entries
router.get(
  "/journal-entries",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.get(
        `${pythonUrl}/api/finance/journal-entries`,
        { params: req.query },
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Journal entries error:", error.message);
      res.json({ success: true, data: [] });
    }
  },
);

router.post(
  "/journal-entries",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.post(
        `${pythonUrl}/api/finance/journal-entries`,
        req.body,
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Create journal entry error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Financial Ratios
router.get(
  "/financial-ratios",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.get(
        `${pythonUrl}/api/finance/financial-ratios`,
        { params: req.query },
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Financial ratios error:", error.message);
      res.json({
        success: true,
        data: {
          liquidity: {},
          profitability: {},
          efficiency: {},
          leverage: {},
        },
      });
    }
  },
);

// Aging Report
router.get(
  "/aging-report",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.get(
        `${pythonUrl}/api/finance/aging-report`,
        { params: req.query },
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Aging report error:", error.message);
      res.json({
        success: true,
        data: { buckets: {}, totals: {}, grand_total: 0 },
      });
    }
  },
);

// Expense Breakdown
router.get(
  "/expense-breakdown",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.get(
        `${pythonUrl}/api/finance/expense-breakdown`,
        { params: req.query },
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Expense breakdown error:", error.message);
      res.status(502).json({
        success: false,
        message: "Failed to fetch expense breakdown from finance service",
      });
    }
  },
);

// Revenue Analysis
router.get(
  "/revenue-analysis",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.get(
        `${pythonUrl}/api/finance/revenue-analysis`,
        { params: req.query },
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Revenue analysis error:", error.message);
      res.json({
        success: true,
        data: {
          total: 0,
          categories: [],
          payment_methods: [],
          daily_trend: [],
        },
      });
    }
  },
);

// Comparative Analysis
router.get(
  "/comparative-analysis",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.get(
        `${pythonUrl}/api/finance/comparative-analysis`,
        { params: req.query },
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Comparative analysis error:", error.message);
      res.json({
        success: true,
        data: { current_period: {}, previous_period: {}, changes: {} },
      });
    }
  },
);

// Generate Financial Report
router.post(
  "/reports/generate",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  async (req, res) => {
    try {
      const axios = require("axios");
      const pythonUrl =
        process.env.PYTHON_SERVICE_URL || "https://services.hirall.com";
      const response = await axios.post(
        `${pythonUrl}/api/finance/reports/generate`,
        req.body,
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Generate report error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Get Branches for Finance
router.get(
  "/branches",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.DIRECTOR,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.BRANCH_MANAGER,
    UserRole.AUDITOR,
  ]),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, code");
      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (error: any) {
      console.error("Get branches error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// DIRECTOR DASHBOARD ROUTES
router.get(
  "/director/overview",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorController.getGlobalOverview,
);

// Enhanced Director Routes
router.get(
  "/director/comprehensive",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorEnhancedController.getComprehensiveDashboard,
);

router.get(
  "/director/payment-breakdown",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorEnhancedController.getPaymentBreakdown,
);

router.get(
  "/director/banking-reconciliation",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorEnhancedController.getBankingReconciliation,
);

router.get(
  "/director/export-pdf",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorEnhancedController.exportPDFReport,
);

router.get(
  "/director/payments",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorController.getPaymentIntelligence,
);

router.get(
  "/director/banking",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorController.getBankingControl,
);

router.get(
  "/director/visuals",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorController.getVisualData,
);

// Director Drill-Down (transaction-level data)
router.get(
  "/director/drill-down",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.AUDITOR,
  ]),
  DirectorEnhancedController.getDrillDownData,
);

// Director Review Tasks
const TASK_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.AUDITOR,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.HR_MANAGER,
  UserRole.BRANCH_MANAGER,
];
router.get(
  "/director/tasks/staff",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DirectorTasksController.getBranchStaff,
);
router.get(
  "/director/tasks",
  authorize(TASK_ROLES),
  DirectorTasksController.getTasks,
);
router.post(
  "/director/tasks",
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]),
  DirectorTasksController.createTask,
);
router.patch(
  "/director/tasks/:id/respond",
  authorize(TASK_ROLES),
  DirectorTasksController.respondToTask,
);
router.patch(
  "/director/tasks/:id/close",
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]),
  DirectorTasksController.closeTask,
);

// DISCREPANCY & FLAG ROUTES
router.get(
  "/discrepancies/export",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
    UserRole.GENERAL_MANAGER,
  ]),
  DiscrepancyController.exportAuditReport,
);

router.get(
  "/discrepancies",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.AUDITOR,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  DiscrepancyController.getFlags,
);

router.get(
  "/discrepancies/aggregate",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.AUDITOR,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  getDiscrepancyAggregate,
);

router.post(
  "/discrepancies",
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.AUDITOR]),
  DiscrepancyController.createFlag,
);

router.patch(
  "/discrepancies/:id/respond",
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
  ]),
  DiscrepancyController.respondToFlag,
);

router.patch(
  "/discrepancies/:id/finalize",
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]),
  DiscrepancyController.finalizeFlag,
);

// ════════════════════════════════════════════════════════════════
// FINANCIAL CLOSE — workspace submission, variance engine, audit
// ════════════════════════════════════════════════════════════════

const CLOSE_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT,
];
const AUDIT_CLOSE_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR,
  UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT,
];
const AUDITOR_ONLY = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR];

// Branch accountant submits the workspace for the day (triggers variance engine)
router.post("/workspace/close", authorize(CLOSE_ROLES), submitWorkspaceClose);

// Provide mandatory explanation when variance is negative (separate step before Post)
router.post("/workspace/submissions/:id/explain", authorize(CLOSE_ROLES), submitVarianceExplanation);

// Accountant clicks "Post" → notifies BOTH Auditor AND Director simultaneously
router.post("/workspace/submissions/:id/post", authorize(CLOSE_ROLES), postWorkspaceSubmission);

// List submissions (accountant sees own branch; auditor/director see all)
router.get("/workspace/submissions", authorize(AUDIT_CLOSE_ROLES), getWorkspaceSubmissions);
router.get("/workspace/submissions/:id", authorize(AUDIT_CLOSE_ROLES), getWorkspaceSubmission);

// Auditor approves or returns a submission
router.patch("/workspace/submissions/:id/review", authorize(AUDITOR_ONLY), reviewWorkspaceSubmission);

// Auditor queue — pending submissions needing review
router.get("/workspace/audit-queue", authorize(AUDITOR_ONLY), getAuditReviewQueue);

// System daily snapshot (auto-generated at midnight)
router.get("/snapshot/:branchId/:date", authorize(AUDIT_CLOSE_ROLES), getDailySnapshot);

// Branch profitability breakdown by outlet
router.get("/branch-profitability", authorize(AUDIT_CLOSE_ROLES), getBranchProfitability);

// ════════════════════════════════════════════════════════════════
// BRANCH PAYROLL WORKSPACE
// ════════════════════════════════════════════════════════════════

const PAYROLL_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR,
  UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.HR_MANAGER,
];
const PAYROLL_GENERATE_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT,
];
const PAYROLL_AUDITOR_ROLES = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR];
const PAYROLL_DIRECTOR_ROLES = [UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER];

router.get("/payroll/batches", authorize(PAYROLL_ROLES), listPayrollBatches);
router.get("/payroll/batches/:id", authorize(PAYROLL_ROLES), getPayrollBatch);
router.get("/payroll/batches/:id/pdf", authorize(PAYROLL_ROLES), downloadPayrollBatchPdf);
router.get("/payroll/batches/:id/payslips-zip", authorize(PAYROLL_ROLES), downloadBatchPayslipsZip);
router.post("/payroll/batches/generate", authorize(PAYROLL_GENERATE_ROLES), generatePayrollBatch);
router.post("/payroll/batches/:id/submit", authorize(PAYROLL_GENERATE_ROLES), submitPayrollBatch);
router.patch("/payroll/batches/:id/review", authorize(PAYROLL_AUDITOR_ROLES), reviewPayrollBatch);
router.patch("/payroll/batches/:id/approve", authorize(PAYROLL_DIRECTOR_ROLES), approvePayrollBatch);
router.get("/payroll/director-summary", authorize(PAYROLL_DIRECTOR_ROLES), getDirectorPayrollSummary);

// ════════════════════════════════════════════════════════════════
// STAFF POS ACCOUNTING (per-waiter/bartender, cleared vs outstanding)
// ════════════════════════════════════════════════════════════════

const STAFF_POS_ACCOUNTING_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR,
  UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT,
];

router.get(
  "/staff-pos-accounting/summary",
  authorize(STAFF_POS_ACCOUNTING_ROLES),
  getStaffPosAccountingSummary,
);
router.get(
  "/staff-pos-accounting/:waiterId/orders",
  authorize(STAFF_POS_ACCOUNTING_ROLES),
  getStaffPosAccountingOrders,
);
router.get(
  "/staff-pos-accounting/deep-drill",
  authorize(STAFF_POS_ACCOUNTING_ROLES),
  getPosDeepDrillOrders,
);

export default router;
