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

const router = express.Router();

// Protected routes
router.use(protect);

// Guest and staff routes
router.get('/invoices/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST]),
  getInvoices
);

// Staff routes
router.get('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST]),
  getInvoices
);

router.post('/payments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST]),
  processPayment
);

// Finance staff routes
router.get('/transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getTransactions
);

router.post('/transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  createTransaction
);

router.post('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  createInvoice
);

router.get('/overview',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getFinancialOverview
);

router.route('/budgets')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]), getBudgets)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createBudget);

router.route('/expenses')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]), getExpenses)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), createExpense);

router.put('/expenses/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  approveExpense
);

// ============== ADVANCED FINANCIAL TOOLS ==============

// Cash Flow Report
router.get('/cashflow',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getCashFlowReport
);

// Profit & Loss Statement
router.get('/profit-loss',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getProfitLossStatement
);

// Revenue by Branch
router.get('/revenue-by-branch',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getRevenueByBranch
);

// Budget vs Actual Analysis
router.get('/budget-analysis',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getBudgetAnalysis
);

// Tax Summary
router.get('/tax-summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getTaxSummary
);

// Financial Forecast
router.get('/forecast',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getFinancialForecast
);

// Accounts Receivable/Payable
router.get('/ar-ap',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getAccountsReceivablePayable
);

// Financial KPIs
router.get('/kpis',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getFinancialKPIs
);

export default router;
