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
  getFinancialKPIs
} from '../controllers/finance.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { supabase } from '../config/database';

const router = express.Router();

// Protected routes
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

// ============== ADVANCED FINANCIAL TOOLS ==============

// Cash Flow Report
router.get('/cashflow',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getCashFlowReport
);

// Profit & Loss Statement
router.get('/profit-loss',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
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

// ============== ADVANCED ACCOUNTING FEATURES ==============

// Balance Sheet
router.get('/balance-sheet',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  async (req, res) => {
    try {
      // Proxy to Python service or implement locally
      const axios = require('axios');
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER]),
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

export default router;
