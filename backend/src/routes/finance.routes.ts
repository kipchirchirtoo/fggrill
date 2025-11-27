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
  approveExpense
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

export default router;
