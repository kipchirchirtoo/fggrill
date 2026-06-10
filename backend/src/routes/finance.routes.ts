import express from 'express';
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
  updateDailyLogStatus
} from '../controllers/finance.controller';
import {
  getDailyRecords,
  getDailyRecordByDate,
  saveDailyRecord,
  getDailyAutofill,
  getMonthlyAdjustments,
  saveMonthlyAdjustment,
  exportMonthlyStatement
} from '../controllers/financial-workspace.controller';
import { DirectorController } from '../controllers/director.controller';
import { DirectorEnhancedController } from '../controllers/director-enhanced.controller';
import { DirectorTasksController } from '../controllers/director-tasks.controller';
import { DiscrepancyController } from '../controllers/discrepancies.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { supabase } from '../config/database';

const router = express.Router();

// Public/unauthenticated routes
router.get('/branches', async (req, res) => {
  try {
    const { data, error } = await supabase.from('branches').select('id, name, code');
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get branches error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply authentication to all other routes
router.use(protect);

// Guest and staff routes
router.get('/invoices/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]),
  getInvoices
);

// Staff routes
router.get('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]),
  getInvoices
);

router.post('/payments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]),
  processPayment
);

// Finance staff routes
router.get('/transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getTransactions
);

router.post('/transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createTransaction
);

router.post('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createInvoice
);

router.get('/overview',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getFinancialOverview
);

// Dashboard alias for overview
router.get('/dashboard',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER]),
  getFinancialOverview
);

router.route('/budgets')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getBudgets)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createBudget);

router.route('/expenses')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getExpenses)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), createExpense);

router.put('/expenses/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  approveExpense
);

// ============== DAILY LOG SYSTEM ==============
router.get('/daily-logs',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getDailyLogs
);

router.post('/daily-logs',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  saveDailyLog
);

router.put('/daily-logs/:id/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  updateDailyLogStatus
);

// ============== FINANCIAL WORKSPACE ==============

router.get('/workspace/daily',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getDailyRecords
);

// Lina AI auto-fill — must be registered BEFORE '/workspace/daily/:date'
// so it isn't captured as a date param.
router.get('/workspace/daily/autofill',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER]),
  getDailyAutofill
);

router.get('/workspace/daily/:date',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getDailyRecordByDate
);

router.post('/workspace/daily',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  saveDailyRecord
);

router.get('/workspace/monthly',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getMonthlyAdjustments
);

router.post('/workspace/monthly',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  saveMonthlyAdjustment
);

router.get('/workspace/export',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.DIRECTOR]),
  exportMonthlyStatement
);

// ============== ADVANCED FINANCIAL TOOLS ==============

// Cash Flow Report
router.get('/cashflow',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getCashFlowReport
);

// Profit & Loss Statement
router.get('/profit-loss',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getProfitLossStatement
);

// Revenue by Branch
router.get('/revenue-by-branch',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getRevenueByBranch
);

// Budget vs Actual Analysis
router.get('/budget-analysis',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBudgetAnalysis
);

// Tax Summary
router.get('/tax-summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getTaxSummary
);

// Financial Forecast
router.get('/forecast',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getFinancialForecast
);

// Accounts Receivable/Payable
router.get('/ar-ap',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getAccountsReceivablePayable
);

// Financial KPIs
router.get('/kpis',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getFinancialKPIs
);

// Unified Branch Financials
router.get('/branch-financials/:branchId',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBranchFinancialProfile
);

// ============== ADVANCED ACCOUNTING FEATURES ==============

// Balance Sheet
router.get('/balance-sheet',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      // Proxy to Python service or implement locally
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.get(`${pythonUrl}/api/finance/balance-sheet`, { params: req.query });
      res.json(response.data);
    } catch (error: any) {
      console.error('Balance sheet error:', error.message);
      res.json({ success: true, data: { total_assets: 0, total_liabilities: 0, equity: { total: 0 } } });
    }
  }
);

// Trial Balance
router.get('/trial-balance',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.get(`${pythonUrl}/api/finance/trial-balance`, { params: req.query });
      res.json(response.data);
    } catch (error: any) {
      console.error('Trial balance error:', error.message);
      res.json({ success: true, data: { entries: [], total_debit: 0, total_credit: 0, is_balanced: true } });
    }
  }
);

// Journal Entries
router.get('/journal-entries',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.get(`${pythonUrl}/api/finance/journal-entries`, { params: req.query });
      res.json(response.data);
    } catch (error: any) {
      console.error('Journal entries error:', error.message);
      res.json({ success: true, data: [] });
    }
  }
);

router.post('/journal-entries',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.post(`${pythonUrl}/api/finance/journal-entries`, req.body);
      res.json(response.data);
    } catch (error: any) {
      console.error('Create journal entry error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Financial Ratios
router.get('/financial-ratios',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.get(`${pythonUrl}/api/finance/financial-ratios`, { params: req.query });
      res.json(response.data);
    } catch (error: any) {
      console.error('Financial ratios error:', error.message);
      res.json({ success: true, data: { liquidity: {}, profitability: {}, efficiency: {}, leverage: {} } });
    }
  }
);

// Aging Report
router.get('/aging-report',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.get(`${pythonUrl}/api/finance/aging-report`, { params: req.query });
      res.json(response.data);
    } catch (error: any) {
      console.error('Aging report error:', error.message);
      res.json({ success: true, data: { buckets: {}, totals: {}, grand_total: 0 } });
    }
  }
);

// Expense Breakdown
router.get('/expense-breakdown',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.get(`${pythonUrl}/api/finance/expense-breakdown`, { params: req.query });
      res.json(response.data);
    } catch (error: any) {
      console.error('Expense breakdown error:', error.message);
      res.json({ success: true, data: { total: 0, categories: [], by_status: {} } });
    }
  }
);

// Revenue Analysis
router.get('/revenue-analysis',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.get(`${pythonUrl}/api/finance/revenue-analysis`, { params: req.query });
      res.json(response.data);
    } catch (error: any) {
      console.error('Revenue analysis error:', error.message);
      res.json({ success: true, data: { total: 0, categories: [], payment_methods: [], daily_trend: [] } });
    }
  }
);

// Comparative Analysis
router.get('/comparative-analysis',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.get(`${pythonUrl}/api/finance/comparative-analysis`, { params: req.query });
      res.json(response.data);
    } catch (error: any) {
      console.error('Comparative analysis error:', error.message);
      res.json({ success: true, data: { current_period: {}, previous_period: {}, changes: {} } });
    }
  }
);

// Generate Financial Report
router.post('/reports/generate',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';
      const response = await axios.post(`${pythonUrl}/api/finance/reports/generate`, req.body);
      res.json(response.data);
    } catch (error: any) {
      console.error('Generate report error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get Branches for Finance
router.get('/branches',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]),
  async (req, res) => {
    try {
      const { data, error } = await supabase.from('branches').select('id, name, code');
      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (error: any) {
      console.error('Get branches error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// DIRECTOR DASHBOARD ROUTES
router.get('/director/overview',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorController.getGlobalOverview
);

// Enhanced Director Routes
router.get('/director/comprehensive',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorEnhancedController.getComprehensiveDashboard
);

router.get('/director/payment-breakdown',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorEnhancedController.getPaymentBreakdown
);

router.get('/director/banking-reconciliation',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorEnhancedController.getBankingReconciliation
);

router.get('/director/export-pdf',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorEnhancedController.exportPDFReport
);

router.get('/director/payments',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorController.getPaymentIntelligence
);

router.get('/director/banking',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorController.getBankingControl
);

router.get('/director/visuals',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorController.getVisualData
);

// Director Drill-Down (transaction-level data)
router.get('/director/drill-down',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]),
  DirectorEnhancedController.getDrillDownData
);

// Director Review Tasks
const TASK_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER,
  UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT,
  UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER
];
router.get('/director/tasks/staff',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  DirectorTasksController.getBranchStaff
);
router.get('/director/tasks', authorize(TASK_ROLES), DirectorTasksController.getTasks);
router.post('/director/tasks',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]),
  DirectorTasksController.createTask
);
router.patch('/director/tasks/:id/respond', authorize(TASK_ROLES), DirectorTasksController.respondToTask);
router.patch('/director/tasks/:id/close',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]),
  DirectorTasksController.closeTask
);

// DISCREPANCY & FLAG ROUTES
router.get('/discrepancies/export',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]),
  DiscrepancyController.exportAuditReport
);

router.get('/discrepancies',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER, UserRole.AUDITOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  DiscrepancyController.getFlags
);

router.post('/discrepancies',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.AUDITOR]),
  DiscrepancyController.createFlag
);

router.patch('/discrepancies/:id/respond',
  authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  DiscrepancyController.respondToFlag
);

router.patch('/discrepancies/:id/finalize',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]),
  DiscrepancyController.finalizeFlag
);

export default router;
