import { fetchAPI, fetchPythonAPI, buildQuery } from './core';
import { 
  ApiResponse, 
  Invoice, 
  Transaction,
  PaymentVerification,
  PaymentStats 
} from './types';

// =====================================
// ACCOUNTING / ERP API
// =====================================

export const accountingAPI = {
  getDashboard: (params?: any) => fetchAPI<any>(`/accounting/dashboard${buildQuery(params)}`),
  getAccounts: (params?: any) => fetchAPI<any[]>(`/accounting/accounts${buildQuery(params)}`),
  createAccount: (data: any) => fetchAPI<any>('/accounting/accounts', { method: 'POST', body: JSON.stringify(data) }),
  getInvoices: (params?: any) => fetchAPI<Invoice[]>(`/accounting/invoices${buildQuery(params)}`),
  getInvoice:  (id: string)   => fetchAPI<Invoice>(`/accounting/invoices/${id}`),
  createInvoice: (data: any)  => fetchAPI<Invoice>('/accounting/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id: string, data: any) => fetchAPI<Invoice>(`/accounting/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  recordInvoicePayment: (id: string, data: any) => fetchAPI<void>(`/accounting/invoices/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  submitInvoiceForAudit: (id: string) => fetchAPI<void>(`/accounting/invoices/${id}/submit-audit`, { method: 'POST' }),
  
  getBills:    (params?: any) => fetchAPI<any[]>(`/accounting/bills${buildQuery(params)}`),
  createBill:  (data: any)    => fetchAPI<any>('/accounting/bills', { method: 'POST', body: JSON.stringify(data) }),
  recordBillPayment: (id: string, data: any) => fetchAPI<void>(`/accounting/bills/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  submitBillForAudit: (id: string) => fetchAPI<void>(`/accounting/bills/${id}/submit-audit`, { method: 'POST' }),
  
  // Banking
  getBankAccounts: (params?: { branch_id?: number }) => fetchAPI<any[]>(`/accounting/bank-accounts${buildQuery(params)}`),
  getBankTransactions: (params?: any) => fetchAPI<any[]>(`/accounting/bank-transactions${buildQuery(params)}`),
  createBankTransaction: (data: any) => fetchAPI<any>('/accounting/bank-transactions', { method: 'POST', body: JSON.stringify(data) }),
  getBankDeposits: (params?: any) => fetchAPI<any[]>(`/accounting/deposits${buildQuery(params)}`),
  createBankDeposit: (data: any) => fetchAPI<any>('/accounting/deposits', { method: 'POST', body: JSON.stringify(data) }),
  
  // Reconciliation
  getReconciliationData: (params?: any) => fetchAPI<any>(`/accounting/reconciliation/data${buildQuery(params)}`),
  matchTransactions: (data: any) => fetchAPI<void>('/accounting/reconciliation/match', { method: 'POST', body: JSON.stringify(data) }),
  
  // Budgets
  getBudgets: (params?: any) => fetchAPI<any[]>(`/accounting/budgets${buildQuery(params)}`),
 
  // Journal Entries
  getJournalEntries: (params?: any) => fetchAPI<any[]>(`/accounting/journal-entries${buildQuery(params)}`),
  createJournalEntry: (data: any) => fetchAPI<any>('/accounting/journal-entries', { method: 'POST', body: JSON.stringify(data) }),
  postJournalEntry: (id: string) => fetchAPI<void>(`/accounting/journal-entries/${id}/post`, { method: 'PUT' }),

  // Missing methods from errors
  getChartOfAccounts: (params?: any) => accountingAPI.getAccounts(params),
  getProfitAndLoss: (params?: any) => fetchAPI<any>(`/accounting/reports/profit-loss${buildQuery(params)}`),
  getFinancialStatements: (params?: any) => fetchAPI<any>(`/accounting/reports/statements${buildQuery(params)}`),
  getTrialBalance: (params?: any) => fetchAPI<any>(`/accounting/reports/trial-balance${buildQuery(params)}`),
  getAgingAnalysis: (params?: any) => fetchAPI<any>(`/accounting/reports/aging${buildQuery(params)}`),
  createComprehensiveJournal: (data: any) => accountingAPI.createJournalEntry(data),
  getFiscalPeriods: () => fetchAPI<any[]>('/accounting/fiscal-periods'),
  closePeriod: (id: string) => fetchAPI<void>(`/accounting/fiscal-periods/${id}/close`, { method: 'POST' }),
  getLedger: (params?: any) => accountingAPI.getJournalEntries(params),
};

// =====================================
// CASHIER / PETTY CASH API
// =====================================

export const pettyCashAPI = {
  getTransactions: (params?: any) => fetchAPI<any[]>(`/petty-cash${buildQuery(params)}`),
  request: (data: any) => fetchAPI<any>('/petty-cash', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string, remarks?: string) => 
    fetchAPI<void>(`/petty-cash/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) }),
};

export const paymentsVerificationAPI = {
  getPayments: (params?: any) => fetchAPI<PaymentVerification[]>(`/payments-verification${buildQuery(params)}`),
  getPaymentStats: (params?: any) => fetchAPI<PaymentStats>(`/payments-verification/stats${buildQuery(params)}`),
  getPaymentById: (id: string) => fetchAPI<PaymentVerification>(`/payments-verification/${id}`),
  verifyByAccountant: (id: string, notes?: string) => 
    fetchAPI<void>(`/payments-verification/${id}/verify-accountant`, { method: 'PUT', body: JSON.stringify({ accountant_notes: notes }) }),
  verifyByAuditor: (id: string, status: string, notes?: string) =>
    fetchAPI<void>(`/payments-verification/${id}/verify-auditor`, { method: 'PUT', body: JSON.stringify({ auditor_status: status, auditor_notes: notes }) }),
};

// =====================================
// RECEIPTS API (Python)
// =====================================

export const receiptsAPI = {
  generateReceipt: (data: any) => fetchPythonAPI<any>('/receipts/generate/base64', { method: 'POST', body: JSON.stringify(data) }),
  printReceipt:    (data: any) => fetchPythonAPI<any>('/receipts/printer/print',     { method: 'POST', body: JSON.stringify(data) }),
  
  configurePrinter: (config: any) => 
    fetchPythonAPI<void>('/receipts/printer/configure', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
};

// =====================================
// BANKING API
// =====================================

export const bankingAPI = {
  getBankAccounts: (params?: { branch_id?: number }) => fetchAPI<any[]>(`/banking/accounts${buildQuery(params)}`),
  createBankAccount: (data: any) => fetchAPI<any>('/banking/accounts', { method: 'POST', body: JSON.stringify(data) }),
  getBankingTransactions: (params?: any) => fetchAPI<any>(`/banking/transactions${buildQuery(params)}`),
  recordBankingTransaction: (data: any) => fetchAPI<any>('/banking/transactions', { method: 'POST', body: JSON.stringify(data) }),
  approveBankingTransaction: (id: string) => fetchAPI<void>(`/banking/transactions/${id}/approve`, { method: 'PUT' }),
  getBankingSummary: () => fetchAPI<any>('/banking/summary'),
  getBankReconciliations: () => fetchAPI<any[]>('/banking/reconciliations'),
  recordBankReconciliation: (data: any) => fetchAPI<any>('/banking/reconciliations', { method: 'POST', body: JSON.stringify(data) }),
};

// =====================================
// FINANCE / DASHBOARD API
// =====================================

export const financeAPI = {
  // Appended for UI Compatibility
  getRevenueByBranch: (params?: any) => fetchAPI<any>('/finance/revenue/branch'),

  getDashboard: (params?: any) => fetchAPI<any>(`/finance/dashboard${buildQuery(params)}`),
  getTransactions: (params?: any) => fetchAPI<Transaction[]>(`/finance/transactions${buildQuery(params)}`),
  createTransaction: (data: any) => fetchAPI<Transaction>('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
  
  // Analytics
  getProfitLoss: (params?: any) => fetchAPI<any>(`/finance/profit-loss${buildQuery(params)}`),
  getCashFlow:   (params?: any) => fetchAPI<any>(`/finance/cashflow${buildQuery(params)}`),
  getTaxSummary: (params?: any) => fetchAPI<any>(`/finance/tax-summary${buildQuery(params)}`),
  
  // Expenses
  getExpenses:   (params?: any) => fetchAPI<any[]>(`/finance/expenses${buildQuery(params)}`),
  createExpense: (data: any) => fetchAPI<any>('/finance/expenses', { method: 'POST', body: JSON.stringify(data) }),
  
  // Compatibility & Extensions
  getBranches: () => fetchAPI<any[]>('/system/branches'),
  getBudgets:   (params?: any) => accountingAPI.getBudgets(params),
  createBudget: (data: any)    => fetchAPI<any>('/accounting/budgets', { method: 'POST', body: JSON.stringify(data) }),
  updateBudget: (id: string, data: any) => fetchAPI<any>(`/accounting/budgets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBudget: (id: string) => fetchAPI<any>(`/accounting/budgets/${id}`, { method: 'DELETE' }),
  
  updateExpense: (id: string, data: any) => fetchAPI<any>(`/finance/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => fetchAPI<any>(`/finance/expenses/${id}`, { method: 'DELETE' }),
  approveExpense: (id: string) => fetchAPI<any>(`/finance/expenses/${id}/approve`, { method: 'POST' }),
  
  getBranchFinancials: (branchId: number) => fetchAPI<any>(`/finance/branches/${branchId}/financials`),
  getFinancialOverview: (params?: any) => fetchAPI<any>(`/finance/overview${buildQuery(params)}`),
  getSupplierInvoiceById: (id: string) => fetchAPI<any>(`/finance/supplier-invoices/${id}`),
  
  // Accounting Aliases
  getInvoices: (params?: any) => accountingAPI.getInvoices(params),
  getInvoice: (id: string) => accountingAPI.getInvoice(id),
  createInvoice: (data: any) => accountingAPI.createInvoice(data),
  updateInvoice: (id: string, data: any) => accountingAPI.updateInvoice(id, data),
  
  // From errors
  processPayment: (data: any) => fetchAPI<any>('/finance/payments/process', { method: 'POST', body: JSON.stringify(data) }),

  accounting: accountingAPI,
  banking: bankingAPI,
  paymentsVerification: paymentsVerificationAPI,
  pettyCash: pettyCashAPI,
  receipts: receiptsAPI,
};
