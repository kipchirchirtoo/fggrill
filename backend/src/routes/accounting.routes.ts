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
  recordInvoicePayment,
  recordBillPayment,
  submitInvoiceForAudit,
  submitBillForAudit,
  createBankTransaction,
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getAccountingDashboard
);

// Chart of Accounts
router.get('/accounts',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getChartOfAccounts
);

router.post('/accounts',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createAccount
);

// Journal Entries
router.get('/journal-entries',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getJournalEntries
);

router.post('/journal-entries',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createJournalEntry
);

router.put('/journal-entries/:id/post',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  postJournalEntry
);

// Accounts Receivable
router.get('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getInvoices
);

router.post('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createInvoice
);

router.post('/invoices/:id/payments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  recordInvoicePayment
);

router.post('/invoices/:id/submit-audit',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  submitInvoiceForAudit
);

// Accounts Payable
router.get('/bills',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBills
);

router.post('/bills',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createBill
);

router.post('/bills/:id/payments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  recordBillPayment
);

router.post('/bills/:id/submit-audit',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  submitBillForAudit
);

// Banking
router.get('/bank-transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBankTransactions
);

router.post('/bank-transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createBankTransaction
);

// Budgets
router.get('/budgets',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBudgets
);

export default router;
