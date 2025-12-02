import express from 'express';
import {
  getChartOfAccounts,
  createAccount,
  createJournalEntry,
  postJournalEntry,
  getJournalEntries,
  createInvoice,
  getInvoices,
  createBill,
  getBills,
  getBankTransactions,
  getBudgets,
  getAccountingDashboard
} from '../controllers/accounting.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

// Dashboard
router.get('/dashboard',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getAccountingDashboard
);

// Chart of Accounts
router.get('/accounts',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getChartOfAccounts
);

router.post('/accounts',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createAccount
);

// Journal Entries
router.get('/journal-entries',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getJournalEntries
);

router.post('/journal-entries',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  createJournalEntry
);

router.put('/journal-entries/:id/post',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  postJournalEntry
);

// Accounts Receivable
router.get('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getInvoices
);

router.post('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  createInvoice
);

// Accounts Payable
router.get('/bills',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getBills
);

router.post('/bills',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  createBill
);

// Banking
router.get('/bank-transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getBankTransactions
);

// Budgets
router.get('/budgets',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getBudgets
);

export default router;
