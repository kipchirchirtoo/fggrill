import express from 'express';
import {
  getChartOfAccounts,
  createAccount,
  createJournalEntry,
  postJournalEntry,
  getJournalEntries,
  createInvoice,
  getInvoices,
  getBookingInvoiceQueue,
  createInvoiceFromBookingSource,
  downloadInvoicePdf,
  createBill,
  getBills,
  recordInvoicePayment,
  recordBillPayment,
  submitInvoiceForAudit,
  submitBillForAudit,
  createBankTransaction,
  getBankTransactions,
  getBudgets,
  getAccountingDashboard,
  getBankDeposits,
  createBankDeposit,
  getReconciliationData,
  matchTransactions,
  getBankAccounts,
  getEventOrders,
  createEventOrder,
  updateEventOrder,
  completeEventOrder,
  deleteEventOrder,
  downloadEventOrderPdf,
  getChannelFoodStandards,
  getChannelPackages,
  getChannelPackageMenuItems,
  createChannelFoodStandard,
  createChannelPackageMenuItem,
  updateChannelFoodStandard,
  deleteChannelFoodStandard,
  deleteChannelPackageMenuItem
} from '../controllers/accounting.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

// Dashboard
router.get('/dashboard',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER]),
  getAccountingDashboard
);

// Chart of Accounts
router.get('/accounts',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER]),
  getChartOfAccounts
);

router.post('/accounts',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createAccount
);

// Journal Entries
router.get('/journal-entries',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
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
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]),
  getInvoices
);

router.get('/booking-invoice-queue',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getBookingInvoiceQueue
);

router.post('/invoices',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]),
  createInvoice
);

router.post('/booking-invoice-queue/:sourceType/:sourceId/invoice',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createInvoiceFromBookingSource
);

// Event Orders
router.get('/event-orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getEventOrders
);

router.post('/event-orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createEventOrder
);

router.put('/event-orders/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  updateEventOrder
);

router.post('/event-orders/:id/complete',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  completeEventOrder
);

router.delete('/event-orders/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  deleteEventOrder
);

router.get('/event-orders/:id/export/pdf',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  downloadEventOrderPdf
);

router.get('/food-control/channel-standards',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getChannelFoodStandards
);

router.get('/food-control/channel-packages',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getChannelPackages
);

router.get('/food-control/channel-package-menu-items',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
  getChannelPackageMenuItems
);

router.post('/food-control/channel-standards',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createChannelFoodStandard
);

router.post('/food-control/channel-package-menu-items',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createChannelPackageMenuItem
);

router.put('/food-control/channel-standards/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  updateChannelFoodStandard
);

router.delete('/food-control/channel-standards/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  deleteChannelFoodStandard
);

router.delete('/food-control/channel-package-menu-items/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  deleteChannelPackageMenuItem
);

router.get('/invoices/:id/pdf',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]),
  downloadInvoicePdf
);

router.post('/invoices/:id/payments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]),
  recordInvoicePayment
);

router.post('/invoices/:id/submit-audit',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]),
  submitInvoiceForAudit
);

// Accounts Payable
router.get('/bills',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]),
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
router.get('/bank-accounts',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBankAccounts
);

router.get('/bank-transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBankTransactions
);

router.post('/bank-transactions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createBankTransaction
);

router.get('/deposits',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBankDeposits
);

router.post('/deposits',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  createBankDeposit
);

// Reconciliation
router.get('/reconciliation/data',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getReconciliationData
);

router.post('/reconciliation/match',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  matchTransactions
);

// Budgets
router.get('/budgets',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
  getBudgets
);

export default router;
