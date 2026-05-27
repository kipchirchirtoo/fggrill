# API Contracts

This file is generated from every TypeScript route module under `backend/src/routes`. It records the route declarations actually present in source code. Handler snippets are intentionally compacted source excerpts so route middleware, controllers, validators, uploads, and role guards remain traceable to file and line.

Route modules inventoried: 99.
Route declarations inventoried: 1387.


Common response shapes observed across controllers remain `{ success, data, message }`, raw arrays for legacy controllers, paginated objects, and binary bytes for export endpoints. Backend authorization remains authoritative even where Flutter hides actions.

## backend/src/routes/accounting.routes.ts

Imports: ../controllers/accounting.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 31 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 34 | GET | `/dashboard` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER]) | - | `router.get('/dashboard', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER]), getAccountingDashboard )` |
| 40 | GET | `/accounts` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER]) | - | `router.get('/accounts', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER]), getChartOfAccounts )` |
| 45 | POST | `/accounts` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/accounts', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createAccount )` |
| 51 | GET | `/journal-entries` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/journal-entries', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getJournalEntries )` |
| 56 | POST | `/journal-entries` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/journal-entries', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createJournalEntry )` |
| 61 | PUT | `/journal-entries/:id/post` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/journal-entries/:id/post', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), postJournalEntry )` |
| 67 | GET | `/invoices` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER, Use) | - | `router.get('/invoices', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]), getInvoices )` |
| 72 | POST | `/invoices` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_S) | - | `router.post('/invoices', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]), createInvoice )` |
| 77 | POST | `/invoices/:id/payments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_S) | - | `router.post('/invoices/:id/payments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]), recordInvoicePayment )` |
| 82 | POST | `/invoices/:id/submit-audit` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_S) | - | `router.post('/invoices/:id/submit-audit', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FRONT_DESK_SUPERVISOR]), submitInvoiceForAudit )` |
| 88 | GET | `/bills` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getBills )` |
| 93 | POST | `/bills` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createBill )` |
| 98 | POST | `/bills/:id/payments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/bills/:id/payments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), recordBillPayment )` |
| 103 | POST | `/bills/:id/submit-audit` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/bills/:id/submit-audit', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), submitBillForAudit )` |
| 109 | GET | `/bank-accounts` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/bank-accounts', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getBankAccounts )` |
| 114 | GET | `/bank-transactions` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/bank-transactions', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getBankTransactions )` |
| 119 | POST | `/bank-transactions` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/bank-transactions', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createBankTransaction )` |
| 124 | GET | `/deposits` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/deposits', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getBankDeposits )` |
| 129 | POST | `/deposits` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/deposits', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createBankDeposit )` |
| 135 | GET | `/reconciliation/data` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/reconciliation/data', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getReconciliationData )` |
| 140 | POST | `/reconciliation/match` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/reconciliation/match', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), matchTransactions )` |
| 146 | GET | `/budgets` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/budgets', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getBudgets )` |

## backend/src/routes/additional-services.routes.ts

Imports: ../controllers/additional-services.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 24 | USE | `(middleware)` | protect | - | `router.use(protect)` |

## backend/src/routes/admin-ai.route.ts

Imports: ../controllers/admin-ai.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 7 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 9 | GET | `/anomalies` | authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]) | - | `router.get('/anomalies', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]), getBehaviorAnomalies )` |
| 14 | GET | `/insights` | authorize([UserRole.SUPER_ADMIN]) | - | `router.get('/insights', authorize([UserRole.SUPER_ADMIN]), getGeminiInsights )` |
| 19 | POST | `/retrain` | authorize([UserRole.SUPER_ADMIN]) | - | `router.post('/retrain', authorize([UserRole.SUPER_ADMIN]), rebuildProfiles )` |

## backend/src/routes/admin-logs.routes.ts

Imports: ../controllers/admin-logs.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 13 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 14 | USE | `(middleware)` | authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]) | - | `router.use(authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]))` |
| 20 | GET | `/overview` | - | - | `router.get('/overview', getLogsOverview)` |
| 26 | GET | `/` | - | - | `router.get('/', getUnifiedLogs)` |
| 32 | GET | `/system` | - | - | `router.get('/system', getSystemLogs)` |

## backend/src/routes/admin.routes.ts

Imports: ../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 7 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 10 | GET | `/role-migrations` | authorize([UserRole.SUPER_ADMIN]) | - | `router.get('/role-migrations', authorize([UserRole.SUPER_ADMIN]), async (req, res) => { try { // Mock data for role migrations const migrations = [ { id: 1, old_role: 'STAFF', new_role: 'RESTAURANT_STAFF', description: 'Consolidate general staff into restauran` |
| 63 | POST | `/role-migrations/:id/execute` | authorize([UserRole.SUPER_ADMIN]) | - | `router.post('/role-migrations/:id/execute', authorize([UserRole.SUPER_ADMIN]), async (req, res) => { try { const { id } = req.params; // Mock execution res.json({ success: true, message: `Role migration ${id} executed successfully`, data: { id: parseInt(id), s` |
| 90 | POST | `/role-migrations/:id/revert` | authorize([UserRole.SUPER_ADMIN]) | - | `router.post('/role-migrations/:id/revert', authorize([UserRole.SUPER_ADMIN]), async (req, res) => { try { const { id } = req.params; // Mock revert res.json({ success: true, message: `Role migration ${id} reverted successfully`, data: { id: parseInt(id), statu` |
| 117 | GET | `/role-migrations/:id/users` | authorize([UserRole.SUPER_ADMIN]) | - | `router.get('/role-migrations/:id/users', authorize([UserRole.SUPER_ADMIN]), async (req, res) => { try { const { id } = req.params; // Mock affected users data const users = [ { id: 1, name: 'John Doe', email: 'john.doe@kyogong.co.ke', role: 'STAFF', branch_nam` |

## backend/src/routes/attendance.routes.ts

Imports: ../controllers/staff.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 12 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 14 | GET | `/` | - | - | `router.get('/', getAttendance)` |
| 15 | POST | `/clock-in` | - | - | `router.post('/clock-in', clockIn)` |
| 16 | POST | `/clock-out` | - | - | `router.post('/clock-out', clockOut)` |

## backend/src/routes/audit.routes.ts

Imports: ../controllers/audit.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 13 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 23 | GET | `/stats` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.get('/stats', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]), getAuditStats )` |

## backend/src/routes/auditor-reports.routes.ts

Imports: ../controllers/auditor-reports.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 21 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 22 | USE | `(middleware)` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.use(authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]))` |
| 25 | GET | `/export/exception_summary` | - | - | `router.get('/export/exception_summary', exportExceptionSummary)` |
| 26 | GET | `/export/compliance_audit` | - | - | `router.get('/export/compliance_audit', exportComplianceAudit)` |
| 27 | GET | `/export/void_analytics` | - | - | `router.get('/export/void_analytics', exportVoidAnalytics)` |
| 28 | GET | `/export/revenue_reconciliation` | - | - | `router.get('/export/revenue_reconciliation', exportRevenueReconciliation)` |
| 29 | GET | `/export/leakage_report` | - | - | `router.get('/export/leakage_report', exportLeakageReport)` |
| 30 | GET | `/export/expenditure_audit` | - | - | `router.get('/export/expenditure_audit', exportExpenditureAudit)` |
| 31 | GET | `/export/variance_report` | - | - | `router.get('/export/variance_report', exportStockVarianceReport)` |
| 32 | GET | `/export/consumption_audit` | - | - | `router.get('/export/consumption_audit', exportConsumptionAnalytics)` |
| 33 | GET | `/export/grn_audit` | - | - | `router.get('/export/grn_audit', exportGrnAudit)` |
| 34 | GET | `/export/stock_movement` | - | - | `router.get('/export/stock_movement', exportStockMovement)` |
| 37 | GET | `/performance` | - | - | `router.get('/performance', getBranchPerformanceReport)` |
| 38 | GET | `/stock-usage` | - | - | `router.get('/stock-usage', getStockUsageReport)` |
| 39 | GET | `/employee-credit` | - | - | `router.get('/employee-credit', getEmployeeCreditReport)` |

## backend/src/routes/auditor-void-bills.routes.ts

Imports: ../controllers/void-bills.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 11 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 16 | GET | `/void-bills` | authorize([UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT]) | - | `router.get('/void-bills', authorize([UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT]), getVoidBills)` |
| 17 | PUT | `/void-bills/:id/review` | authorize([UserRole.SUPER_ADMIN, UserRole.AUDITOR]) | - | `router.put('/void-bills/:id/review', authorize([UserRole.SUPER_ADMIN, UserRole.AUDITOR]), reviewVoidBill)` |

## backend/src/routes/auditor.routes.ts

Imports: ../controllers/auditor-advanced.controller<br>../controllers/auditor.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 49 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 52 | POST | `/night-audit/start` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]) | - | `router.post('/night-audit/start', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]), startNightAudit )` |
| 57 | PUT | `/night-audit/:id/complete` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]) | - | `router.put('/night-audit/:id/complete', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]), completeNightAudit )` |
| 62 | GET | `/night-audit` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]) | - | `router.get('/night-audit', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]), getNightAudits )` |
| 68 | POST | `/exceptions` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.post('/exceptions', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), createException )` |
| 73 | PUT | `/exceptions/:id/resolve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.put('/exceptions/:id/resolve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), resolveException )` |
| 78 | GET | `/exceptions` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/exceptions', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), getExceptions )` |
| 84 | GET | `/trail` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.get('/trail', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]), getAuditTrail )` |
| 90 | POST | `/plans` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/plans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createAuditPlan )` |
| 95 | POST | `/findings` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/findings', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createFinding )` |
| 100 | GET | `/findings` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]) | - | `router.get('/findings', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]), getFindings )` |
| 106 | GET | `/consumption/configs` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/consumption/configs', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), getConsumptionConfigs )` |
| 111 | POST | `/consumption/configs` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.post('/consumption/configs', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), updateConsumptionConfig )` |
| 116 | GET | `/consumption/variances` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/consumption/variances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), getConsumptionVariances )` |
| 122 | POST | `/approvals` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.post('/approvals', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), submitApproval )` |
| 127 | GET | `/approvals` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/approvals', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), getApprovalHistory )` |
| 132 | GET | `/approvals/pending` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.get('/approvals/pending', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), getPendingApprovals )` |
| 137 | POST | `/approvals/handle` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.post('/approvals/handle', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]), handleApprovalRequest )` |
| 142 | POST | `/approvals/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.post('/approvals/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]), approvePendingRequest )` |
| 147 | POST | `/approvals/reject` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.post('/approvals/reject', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]), rejectPendingRequest )` |
| 152 | GET | `/payroll/variances` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/payroll/variances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]), getPayrollVariances )` |
| 158 | GET | `/verify/sales` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/sales', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getSalesVerification)` |
| 159 | GET | `/verify/finances` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/finances', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getFinancialReconciliation)` |
| 160 | GET | `/verify/revenue` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/revenue', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getRevenueOversight)` |
| 161 | GET | `/verify/expenditure` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/expenditure', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getExpenditureVerification)` |
| 162 | GET | `/verify/stock-levels` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/stock-levels', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getStockLevelsVerification)` |
| 163 | GET | `/verify/stock-levels/export` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/stock-levels/export', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), exportStockLedger)` |
| 164 | POST | `/export/stock-ledger` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/export/stock-ledger', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), exportStockLedger)` |
| 165 | GET | `/verify/branch-orders` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/branch-orders', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getBranchOrdersVerification)` |
| 166 | GET | `/verify/sold-items` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/verify/sold-items', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), getSoldItemsAnalysis)` |
| 167 | GET | `/verify/bar-stock` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/bar-stock', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getBarStockAudits)` |
| 168 | POST | `/verify/bar-stock/:id/verify` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/verify/bar-stock/:id/verify', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyBarStockTake)` |
| 169 | GET | `/bar/stock-audits` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/bar/stock-audits', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getBarStockAudits)` |
| 170 | POST | `/bar/stock-audits/:id/verify` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/bar/stock-audits/:id/verify', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyBarStockTake)` |
| 171 | GET | `/verify/details` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/verify/details', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getAnomalyDetail)` |
| 172 | POST | `/verify/clear` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/verify/clear', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyAnomaly)` |
| 175 | GET | `/anomalies/:id` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/anomalies/:id', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getAnomalyDetail)` |
| 176 | POST | `/anomalies/:id/clear` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/anomalies/:id/clear', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyAnomaly)` |
| 179 | GET | `/daily-logs` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT]) | - | `router.get('/daily-logs', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT]), getDailyLogsStatus)` |
| 180 | POST | `/daily-logs/:id/verify` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/daily-logs/:id/verify', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), verifyDailyLog)` |
| 183 | GET | `/staff-audit` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/staff-audit', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), getStaffAudit)` |
| 186 | POST | `/watchlist` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/watchlist', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), flagItem)` |
| 187 | GET | `/watchlist` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/watchlist', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getWatchlist)` |
| 188 | PUT | `/watchlist/:id` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.put('/watchlist/:id', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), resolveWatchlistItem)` |

## backend/src/routes/auth.routes.ts

Imports: ../controllers/auth.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 18 | POST | `/register` | - | - | `router.post('/register', register)` |
| 19 | POST | `/login` | - | - | `router.post('/login', login)` |
| 20 | POST | `/pos-login` | - | - | `router.post('/pos-login', posLogin)` |
| 21 | POST | `/refresh-token` | - | - | `router.post('/refresh-token', refreshToken)` |
| 22 | POST | `/logout` | protect | - | `router.post('/logout', protect, logout)` |
| 23 | GET | `/me` | protect | - | `router.get('/me', protect, getMe)` |
| 24 | PUT | `/updatedetails` | protect | - | `router.put('/updatedetails', protect, updateDetails)` |
| 25 | PUT | `/updatepassword` | protect | - | `router.put('/updatepassword', protect, updatePassword)` |
| 26 | POST | `/forgotpassword` | - | - | `router.post('/forgotpassword', forgotPassword)` |
| 27 | POST | `/switch-context` | protect | - | `router.post('/switch-context', protect, switchContext)` |

## backend/src/routes/automation.routes.ts

Imports: ../middleware/auth<br>../models/User<br>../services/alerts.service<br>../services/reports.service<br>../services/scheduler.service<br>../utils/logger<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 16 | GET | `/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER])<br>protect | - | `router.get( '/status', protect, authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), async (req, res) => { try { const activeJobs = schedulerService.getActiveJobs(); res.json({ success: true, data: { active: activeJobs.length > 0, jobs: activeJobs } })` |
| 43 | POST | `/start` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER])<br>protect | - | `router.post( '/start', protect, authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), async (req, res) => { try { const jobs = schedulerService.startAll(); res.json({ success: true, message: 'Automation system started', data: { jobs: Object.keys(jobs) }` |
| 70 | POST | `/stop` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER])<br>protect | - | `router.post( '/stop', protect, authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), async (req, res) => { try { schedulerService.stopAll(); res.json({ success: true, message: 'Automation system stopped' }); } catch (error) { logger.error('Error stoppin` |
| 94 | POST | `/run/low-stock-check` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER])<br>protect | - | `router.post( '/run/low-stock-check', protect, authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]), async (req, res) => { try { const alertCount = await alertsService.checkLowStock(); res.json({ success: true, message: `Low` |
| 119 | POST | `/run/compliance-check` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER])<br>protect | - | `router.post( '/run/compliance-check', protect, authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), async (req, res) => { try { const { days = 14 } = req.body; const alertCount = await alertsService.checkComplianceExpiry(days); res.json({ success: true` |
| 145 | POST | `/run/budget-check` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT])<br>protect | - | `router.post( '/run/budget-check', protect, authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]), async (req, res) => { try { const { threshold = 10 } = req.body; const alertCount = await alertsService.checkBudgetVariances(threshold)` |
| 171 | POST | `/run/performance-check` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER])<br>protect | - | `router.post( '/run/performance-check', protect, authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), async (req, res) => { try { const { threshold = 15 } = req.body; const alertCount = await alertsService.checkPerformanceMetrics(threshold); res.json({ ` |
| 197 | POST | `/run/generate-reports` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER])<br>protect | - | `router.post( '/run/generate-reports', protect, authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), async (req, res) => { try { const { period = 'daily' } = req.body; const reportsCount = await reportsService.generateScheduledReports(period as any); re` |

## backend/src/routes/banking.routes.ts

Imports: ../controllers/banking.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 18 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 21 | GET | `/accounts` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/accounts', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]), getBankAccounts )` |
| 26 | POST | `/accounts` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/accounts', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createBankAccount )` |
| 32 | GET | `/transactions` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/transactions', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]), getBankingTransactions )` |
| 37 | POST | `/transactions` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/transactions', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), recordBankingTransaction )` |
| 42 | PUT | `/transactions/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.put('/transactions/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]), approveBankingTransaction )` |
| 48 | GET | `/summary` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/summary', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]), getBankingSummary )` |
| 54 | GET | `/reconciliations` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/reconciliations', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]), getBankReconciliations )` |
| 59 | POST | `/reconciliations` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/reconciliations', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), recordBankReconciliation )` |

## backend/src/routes/bar-stock-requests.routes.ts

Imports: ../controllers/bar/stock-requests.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 16 | USE | `(middleware)` | authenticate | - | `router.use(authenticate)` |
| 23 | GET | `/low-stock` | - | - | `router.get('/low-stock', getLowStockItems)` |
| 30 | GET | `/` | - | - | `router.get('/', getStockRequests)` |
| 37 | POST | `/` | - | - | `router.post('/', createStockRequest)` |
| 44 | GET | `/:id` | - | - | `router.get('/:id', getStockRequest)` |
| 51 | PUT | `/:id/status` | - | - | `router.put('/:id/status', updateRequestStatus)` |
| 58 | PUT | `/:id/fulfill` | - | - | `router.put('/:id/fulfill', fulfillStockRequest)` |
| 65 | DELETE | `/:id` | - | - | `router.delete('/:id', deleteStockRequest)` |

## backend/src/routes/bar.routes.ts

Imports: ../controllers/bar/inventory.controller<br>../controllers/bar/menu.controller<br>../controllers/bar/orders.controller<br>../controllers/bar/pool-tokens.controller<br>../controllers/bar/reports.controller<br>../controllers/bar/stock-requests.controller<br>../controllers/bar/sync.controller<br>../controllers/bar/tabs.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 16 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 18 | USE | `(middleware)` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]) | - | `router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT]))` |
| 24 | GET | `/pool-table/earnings` | - | - | `router.get('/pool-table/earnings', poolTokenController.getSales)` |
| 25 | POST | `/pool-table/tokens` | - | - | `router.post('/pool-table/tokens', poolTokenController.recordSale)` |
| 30 | GET | `/orders` | - | - | `router.get('/orders', orderController.getOrders)` |
| 31 | GET | `/orders/:id` | - | - | `router.get('/orders/:id', orderController.getOrder)` |
| 32 | POST | `/orders` | - | - | `router.post('/orders', orderController.createOrder)` |
| 33 | PUT | `/orders/:id` | - | - | `router.put('/orders/:id', orderController.updateOrder)` |
| 34 | PUT | `/orders/:id/status` | - | - | `router.put('/orders/:id/status', orderController.updateOrderStatus)` |
| 39 | GET | `/categories` | - | - | `router.get('/categories', menuController.getCategories)` |
| 40 | POST | `/categories` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/categories', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), menuController.createCategory)` |
| 42 | GET | `/drinks` | - | - | `router.get('/drinks', menuController.getDrinks)` |
| 43 | GET | `/drinks/:id` | - | - | `router.get('/drinks/:id', menuController.getDrink)` |
| 44 | POST | `/drinks` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/drinks', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), menuController.createDrink)` |
| 45 | PUT | `/drinks/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/drinks/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), menuController.updateDrink)` |
| 46 | DELETE | `/drinks/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.delete('/drinks/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), menuController.deleteDrink)` |
| 47 | PUT | `/drinks/:id/toggle` | - | - | `router.put('/drinks/:id/toggle', menuController.toggleDrinkAvailability)` |
| 48 | POST | `/drinks/:id/image` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/drinks/:id/image', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), menuController.uploadDrinkImage)` |
| 53 | GET | `/tabs` | - | - | `router.get('/tabs', tabController.getTabs)` |
| 54 | POST | `/tabs` | - | - | `router.post('/tabs', tabController.createTab)` |
| 55 | PUT | `/tabs/:id` | - | - | `router.put('/tabs/:id', tabController.updateTab)` |
| 56 | DELETE | `/tabs/:id` | - | - | `router.delete('/tabs/:id', tabController.deleteTab)` |
| 57 | POST | `/tabs/:id/items` | - | - | `router.post('/tabs/:id/items', tabController.addToTab)` |
| 58 | POST | `/tabs/:id/close` | - | - | `router.post('/tabs/:id/close', tabController.closeTab)` |
| 63 | POST | `/stock/sync` | - | - | `router.post('/stock/sync', syncController.syncFromMaster)` |
| 64 | GET | `/stock` | - | - | `router.get('/stock', inventoryController.getStock)` |
| 65 | GET | `/stock/logs` | - | - | `router.get('/stock/logs', inventoryController.getStockLogs)` |
| 66 | GET | `/stock/consumption-report` | - | - | `router.get('/stock/consumption-report', inventoryController.getConsumptionReport)` |
| 67 | POST | `/stock/take` | - | - | `router.post('/stock/take', inventoryController.submitStockTake)` |
| 68 | PUT | `/stock/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]) | - | `router.put('/stock/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]), inventoryController.updateStock)` |
| 73 | GET | `/reports/daily-sales` | - | - | `router.get('/reports/daily-sales', reportController.getDailySales)` |
| 74 | GET | `/reports/popular-drinks` | - | - | `router.get('/reports/popular-drinks', reportController.getPopularDrinks)` |
| 79 | GET | `/stock-requests/low-stock` | - | - | `router.get('/stock-requests/low-stock', stockRequestController.getLowStockItems)` |
| 80 | GET | `/stock-requests` | - | - | `router.get('/stock-requests', stockRequestController.getStockRequests)` |
| 81 | POST | `/stock-requests` | - | - | `router.post('/stock-requests', stockRequestController.createStockRequest)` |
| 82 | GET | `/stock-requests/:id` | - | - | `router.get('/stock-requests/:id', stockRequestController.getStockRequest)` |
| 83 | PUT | `/stock-requests/:id/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]) | - | `router.put('/stock-requests/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), stockRequestController.updateRequestStatus)` |
| 84 | PUT | `/stock-requests/:id/fulfill` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]) | - | `router.put('/stock-requests/:id/fulfill', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), stockRequestController.fulfillStockRequest)` |
| 85 | DELETE | `/stock-requests/:id` | - | - | `router.delete('/stock-requests/:id', stockRequestController.deleteStockRequest)` |

## backend/src/routes/barcode.routes.ts

Imports: ../controllers/barcode.controller<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 13 | POST | `/generate` | - | - | `router.post('/generate', generateBarcode)` |
| 14 | POST | `/generate-qr` | - | - | `router.post('/generate-qr', generateQRCode)` |
| 15 | POST | `/generate-card` | - | - | `router.post('/generate-card', generateBookingCard)` |
| 16 | GET | `/image-url/:bookingId` | - | - | `router.get('/image-url/:bookingId', getBarcodeImageUrl)` |
| 17 | GET | `/health` | - | - | `router.get('/health', testBarcodeService)` |

## backend/src/routes/booking.routes.ts

Imports: ../controllers/booking.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 22 | GET | `/available` | - | - | `router.get('/available', getAvailableRooms)` |
| 23 | GET | `/check-availability` | - | - | `router.get('/check-availability', checkAvailability)` |
| 24 | POST | `/quote` | - | - | `router.post('/quote', getPricingQuote)` |
| 25 | GET | `/confirmation/:confirmationNumber` | - | - | `router.get('/confirmation/:confirmationNumber', getBookingByConfirmation)` |
| 26 | POST | `/` | - | - | `router.post('/', createBooking)` |
| 29 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 31 | GET | `/` | - | - | `router.get('/', getBookings)` |
| 32 | GET | `/:id` | - | - | `router.get('/:id', getBooking)` |
| 34 | PUT | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]) | - | `router.put('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]), updateBooking )` |
| 39 | PUT | `/:id/check-in` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]) | - | `router.put('/:id/check-in', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]), checkInBooking )` |
| 44 | PUT | `/:id/check-out` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]) | - | `router.put('/:id/check-out', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]), checkOutBooking )` |
| 49 | PUT | `/:id/cancel` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]) | - | `router.put('/:id/cancel', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]), cancelBooking )` |
| 54 | PUT | `/:id/modify` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]) | - | `router.put('/:id/modify', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]), modifyBooking )` |

## backend/src/routes/branch-analytics.routes.ts

Imports: ../controllers/branch-analytics.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 16 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 23 | POST | `/branch-sales` | authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]) | - | `router.post( '/branch-sales', authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]), getBranchSales )` |
| 35 | GET | `/branch-sales/summary` | authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]) | - | `router.get( '/branch-sales/summary', authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]), getBranchSalesSummary )` |
| 46 | POST | `/branch-sales/export/pdf` | authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]) | - | `router.post( '/branch-sales/export/pdf', authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]), exportBranchSalesPDF )` |
| 57 | POST | `/branch-sales/export/csv` | authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]) | - | `router.post( '/branch-sales/export/csv', authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]), exportBranchSalesCSV )` |

## backend/src/routes/branch-operations-finances.routes.ts

Imports: ../controllers/budget.controller<br>../middleware/auth<br>../middleware/branch<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 45 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 46 | USE | `(middleware)` | - | - | `router.use(validateBranch)` |
| 96 | POST | `/budgets/:id/expenses` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT ]) | - | `router.post( '/budgets/:id/expenses', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT ]), linkExpenseToBudget )` |
| 106 | GET | `/budget-summary` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.BRANCH_OPERATIONS_MANAGER ]) | - | `router.get( '/budget-summary', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.BRANCH_OPERATIONS_MANAGER ]), getBudgetSummary )` |
| 118 | GET | `/budget-analysis` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.BRANCH_OPERATIONS_MANAGER ]) | - | `router.get( '/budget-analysis', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.BRANCH_OPERATIONS_MANAGER ]), getBudgetAnalysis )` |

## backend/src/routes/branch-operations.routes.ts

Imports: ../config/supabase<br>../db<br>../middleware/auth<br>../middleware/branch<br>../models/Room<br>../services/booking.service<br>../services/branch-inventory.service<br>./branch-operations-finances.routes<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 38 | GET | `/reservations` | protect | query() | `router.get('/reservations', protect, validateBranch, async (req, res) => { try { const { status, from, to } = req.query; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Build query with filters let query = ` SELECT b.id, b.booking_number` |
| 113 | GET | `/stock-requests` | protect | - | `router.get('/stock-requests', protect, validateBranch, async (req, res) => { try { // Real data from database res.status(200).json({ success: true, message: 'Stock requests retrieved', data: [] }); } catch (error) { console.error('Error getting stock requests:` |
| 132 | GET | `/inventory` | protect | - | `router.get('/inventory', protect, validateBranch, async (req, res) => { try { // TODO: Implement detailed branch inventory view using branch_stock res.status(200).json({ success: true, message: 'Branch inventory retrieved', data: [] }); } catch (error) { conso` |
| 151 | GET | `/inventory/incoming` | protect | - | `router.get('/inventory/incoming', protect, validateBranch, async (req, res) => { try { const branchIdHeader = req.headers['x-branch-id'] \|\| req.query.branch_id; const branchId = branchIdHeader ? Number(branchIdHeader) : NaN; if (!branchId \|\| Number.isNaN(branc` |
| 181 | GET | `/inventory/stock-takes` | protect | - | `router.get('/inventory/stock-takes', protect, validateBranch, async (req, res) => { try { const { status } = req.query; // For now, return empty array since we don't have stock_takes table yet res.status(200).json({ success: true, message: 'Stock takes retriev` |
| 201 | POST | `/inventory/stock-takes` | protect | query() | `router.post('/inventory/stock-takes', protect, validateBranch, async (req, res) => { try { const data = req.body; // For now, return success since we don't have stock_takes table yet res.status(201).json({ success: true, message: 'Stock take created successful` |
| 222 | GET | `/staff` | protect | query() | `router.get('/staff', protect, validateBranch, async (req, res) => { try { // In development mode, always return mock data if (process.env.NODE_ENV === 'development') { const mockData = [ { id: '1', name: 'John Doe', firstName: 'John', lastName: 'Doe', role: 'b` |
| 345 | GET | `/dashboard` | protect | query() | `router.get('/dashboard', protect, validateBranch, async (req, res) => { try { const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Get room statistics const roomStatsQuery = ` SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'occupied' THEN` |
| 504 | GET | `/staff` | - | - | `router.get('/staff', ...)` |
| 517 | GET | `/staff/shift-types` | protect | query() | `router.get('/staff/shift-types', protect, validateBranch, async (req, res) => { try { // In development mode, always return mock data if (process.env.NODE_ENV === 'development') { const mockShiftTypes = [ { id: '1', name: 'Morning', color: 'bg-blue-100 text-bl` |
| 604 | GET | `/staff/shifts` | protect | query() | `router.get('/staff/shifts', protect, validateBranch, async (req, res) => { try { // In development mode, always return mock data if (process.env.NODE_ENV === 'development') { const { startDate, endDate, staffId } = req.query; const startDateObj = startDate ? n` |
| 792 | POST | `/staff/shifts` | protect | query() | `router.post('/staff/shifts', protect, validateBranch, async (req, res) => { try { const { staff_id, shift_date, start_time, end_time, shift_type_id, is_confirmed = false } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const us` |
| 890 | PUT | `/staff/shifts/:shiftId` | protect | query() | `router.put('/staff/shifts/:shiftId', protect, validateBranch, async (req, res) => { try { const { shiftId } = req.params; const { start_time, end_time, shift_type_id, is_confirmed } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id` |
| 974 | DELETE | `/staff/shifts/:shiftId` | protect | query() | `router.delete('/staff/shifts/:shiftId', protect, validateBranch, async (req, res) => { try { const { shiftId } = req.params; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Verify shift belongs to branch const shiftCheck = await db.query` |
| 1011 | GET | `/staff/attendance` | protect | query() | `router.get('/staff/attendance', protect, validateBranch, async (req, res) => { try { // In development mode, always return mock data if (process.env.NODE_ENV === 'development') { const { startDate, endDate, staffId } = req.query; const startDateObj = startDate` |
| 1215 | POST | `/staff/attendance` | protect | query() | `router.post('/staff/attendance', protect, validateBranch, async (req, res) => { try { const { staff_id, date, status, check_in, check_out, notes } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Validate inputs if (!staff_id ` |
| 1296 | GET | `/rooms` | protect | query() | `router.get('/rooms', protect, validateBranch, async (req, res) => { try { const { status, floor } = req.query; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // console.log('GET /rooms - Branch ID:', branchId, 'Type:', typeof branchId); //` |
| 1405 | PUT | `/rooms/:roomId/status` | protect | query() | `router.put('/rooms/:roomId/status', protect, validateBranch, async (req, res) => { try { const { roomId } = req.params; const { status } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const userId = req.user.id; // Validate inp` |
| 1478 | GET | `/rooms/:roomId` | protect | - | `router.get('/rooms/:roomId', protect, validateBranch, async (req, res) => { try { const { roomId } = req.params; // Real data from database with detailed room information res.status(200).json({ success: true, message: 'Room details retrieved', data: { id: room` |
| 1524 | PUT | `/rooms/:roomId/clean-status` | protect | query() | `router.put('/rooms/:roomId/clean-status', protect, validateBranch, async (req, res) => { try { const { roomId } = req.params; const { isClean } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Validate inputs if (!roomId \|\| is` |
| 1583 | GET | `/service-requests` | protect | - | `router.get('/service-requests', protect, validateBranch, async (req, res) => { try { // Real data from database res.status(200).json({ success: true, message: 'Service requests retrieved', data: [] }); } catch (error) { console.error('Error getting service req` |
| 1601 | POST | `/service-requests` | protect | - | `router.post('/service-requests', protect, validateBranch, async (req, res) => { try { const requestData = req.body; // Validate inputs if (!requestData.description \|\| !requestData.type) { return res.status(400).json({ success: false, message: 'Description and ` |
| 1634 | PUT | `/service-requests/:requestId/status` | protect | - | `router.put('/service-requests/:requestId/status', protect, validateBranch, async (req, res) => { try { const { requestId } = req.params; const { status } = req.body; // Validate inputs if (!requestId \|\| !status) { return res.status(400).json({ success: false, ` |
| 1664 | GET | `/communications` | protect | - | `router.get('/communications', protect, validateBranch, async (req, res) => { try { // Real data from database res.status(200).json({ success: true, message: 'Communications retrieved', data: [] }); } catch (error) { console.error('Error getting communications:` |
| 1682 | GET | `/communications/messages` | protect | query() | `router.get('/communications/messages', protect, validateBranch, async (req, res) => { try { const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const userId = req.user.id; // Get messages for the user const query = ` SELECT m.id, m.subject, m.c` |
| 1745 | POST | `/communications/messages` | protect | query() | `router.post('/communications/messages', protect, validateBranch, async (req, res) => { try { const { recipient_id, subject, content, priority = 'medium', is_global = false } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const ` |
| 1836 | PUT | `/communications/messages/:messageId/read` | protect | query() | `router.put('/communications/messages/:messageId/read', protect, validateBranch, async (req, res) => { try { const { messageId } = req.params; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const userId = req.user.id; // Verify message belo` |
| 1876 | GET | `/communications/notifications` | protect | query() | `router.get('/communications/notifications', protect, validateBranch, async (req, res) => { try { const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Get notifications for the branch const query = ` SELECT id, title, content, notification_typ` |
| 1917 | PUT | `/communications/notifications/:notificationId/read` | protect | query() | `router.put('/communications/notifications/:notificationId/read', protect, validateBranch, async (req, res) => { try { const { notificationId } = req.params; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Verify notification belongs to b` |
| 1956 | GET | `/communications/announcements` | protect | query() | `router.get('/communications/announcements', protect, validateBranch, async (req, res) => { try { const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const userId = req.user.id; // Get user's department const userDeptQuery = ` SELECT department ` |
| 2010 | POST | `/communications/announcements` | protect | query() | `router.post('/communications/announcements', protect, validateBranch, async (req, res) => { try { const { title, content, is_pinned = false, is_global = false, importance = 'medium', expires_at = null, target_departments = null } = req.body; const branchId = r` |
| 2080 | PUT | `/communications/announcements/:announcementId/pin` | protect | query() | `router.put('/communications/announcements/:announcementId/pin', protect, validateBranch, async (req, res) => { try { const { announcementId } = req.params; const { isPinned } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; if (i` |
| 2128 | GET | `/finances/revenue` | protect | query() | `router.get('/finances/revenue', protect, validateBranch, async (req, res) => { try { const { startDate, endDate, period } = req.query; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Default date range if not provided const start = start` |
| 2241 | GET | `/finances/reports` | protect | query() | `router.get('/finances/reports', protect, validateBranch, async (req, res) => { try { const { type, startDate, endDate } = req.query; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Build the query with filters let query = ` SELECT fr.id,` |
| 2321 | POST | `/finances/reports` | protect | query() | `router.post('/finances/reports', protect, validateBranch, async (req, res) => { try { const { title, report_type, period, start_date, end_date } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const userId = req.user.id; // Vali` |
| 2403 | USE | `/finances` | - | - | `router.use('/finances', branchOperationsFinancesRoutes)` |
| 2406 | GET | `/finances/reports/download/:reportId` | protect | query() | `router.get('/finances/reports/download/:reportId', protect, validateBranch, async (req, res) => { try { const { reportId } = req.params; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Check if report exists and belongs to the branch con` |
| 2450 | GET | `/finances/summary` | protect | - | `router.get('/finances/summary', protect, validateBranch, async (req, res) => { try { const { period } = req.query; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Get current date ranges const today = new Date(); const todayStart = new D` |
| 2624 | GET | `/finances/expenses` | protect | - | `router.get('/finances/expenses', protect, validateBranch, async (req, res) => { try { // Extract query parameters const { startDate, endDate, category, status } = req.query; // Real data from database res.status(200).json({ success: true, message: 'Expenses re` |
| 2648 | POST | `/finances/expenses` | protect | - | `router.post('/finances/expenses', protect, validateBranch, async (req, res) => { try { const expenseData = req.body; // Validate inputs if (!expenseData.description \|\| !expenseData.amount) { return res.status(400).json({ success: false, message: 'Description a` |
| 2681 | PUT | `/finances/expenses/:expenseId/approve` | protect | - | `router.put('/finances/expenses/:expenseId/approve', protect, validateBranch, async (req, res) => { try { const { expenseId } = req.params; // Real data from database res.status(200).json({ success: true, message: 'Expense approved', data: { id: expenseId, stat` |
| 2701 | PUT | `/finances/expenses/:expenseId/reject` | protect | - | `router.put('/finances/expenses/:expenseId/reject', protect, validateBranch, async (req, res) => { try { const { expenseId } = req.params; // Real data from database res.status(200).json({ success: true, message: 'Expense rejected', data: { id: expenseId, statu` |
| 2722 | GET | `/reservations` | protect | query() | `router.get('/reservations', protect, validateBranch, async (req, res) => { try { const { status, from, to } = req.query; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Build query with filters let query = ` SELECT b.id, b.reservation_nu` |
| 2792 | POST | `/reservations` | protect | query() | `router.post('/reservations', protect, validateBranch, async (req, res) => { try { const { guest_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date, room_id, adults, children, total_amount, payment_status, special_requests } = req.body; con` |
| 2924 | GET | `/reservations/:id` | protect | query() | `router.get('/reservations/:id', protect, validateBranch, async (req, res) => { try { const { id } = req.params; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const query = ` SELECT b.*, r.room_number, r.floor, rt.name as room_type, rt.bas` |
| 2966 | PUT | `/reservations/:id/status` | protect | query() | `router.put('/reservations/:id/status', protect, validateBranch, async (req, res) => { try { const { id } = req.params; const { status } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Validate status const validStatuses = ['c` |
| 3037 | POST | `/rooms` | protect | query() | `router.post('/rooms', protect, async (req, res) => { try { // Accept both camelCase and snake_case field names const room_number = req.body.room_number \|\| req.body.roomNumber; const room_type = req.body.room_type \|\| req.body.roomType \|\| req.body.type; const fl` |
| 3175 | PUT | `/rooms/:roomId` | protect | query() | `router.put('/rooms/:roomId', protect, async (req, res) => { try { const { roomId } = req.params; const { room_number, room_type, floor, price_override, status } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // console.log('Upd` |
| 3302 | DELETE | `/rooms/:roomId` | protect | query() | `router.delete('/rooms/:roomId', protect, async (req, res) => { try { const { roomId } = req.params; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Check if room exists and belongs to this branch const roomCheck = await db.query( 'SELECT` |
| 3354 | POST | `/staff` | protect | query() | `router.post('/staff', protect, validateBranch, async (req, res) => { try { const { first_name, last_name, email, phone, position, department, national_id, status } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; // Validate requ` |
| 3409 | PUT | `/staff/:id` | protect | query() | `router.put('/staff/:id', protect, validateBranch, async (req, res) => { try { const { id } = req.params; const { first_name, last_name, email, phone, position, department, national_id, status } = req.body; const branchId = req.headers['x-branch-id'] \|\| req.que` |
| 3456 | DELETE | `/staff/:id` | protect | query() | `router.delete('/staff/:id', protect, validateBranch, async (req, res) => { try { const { id } = req.params; const branchId = req.headers['x-branch-id'] \|\| req.query.branch_id; const result = await db.query('DELETE FROM staff_profiles WHERE id = $1 AND branch_i` |

## backend/src/routes/branchFoodControlConfig.routes.ts

Imports: ../controllers/branchFoodControlConfig.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 13 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 16 | GET | `/:branchId` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR ]) | - | `router.get('/:branchId', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR ]), getBranchConfig)` |
| 24 | PUT | `/:branchId` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]) | - | `router.put('/:branchId', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]), updateBranchConfig)` |
| 31 | GET | `/` | authorize([ UserRole.SUPER_ADMIN, UserRole.AUDITOR ]) | - | `router.get('/', authorize([ UserRole.SUPER_ADMIN, UserRole.AUDITOR ]), getAllBranchConfigs)` |

## backend/src/routes/buffet.routes.ts

Imports: ../controllers/buffet.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 22 | USE | `(middleware)` | - | - | `router.use(authenticateToken)` |
| 25 | GET | `/` | - | - | `router.get('/', getBuffets)` |
| 26 | GET | `/:id` | - | - | `router.get('/:id', getBuffet)` |
| 27 | POST | `/` | - | - | `router.post('/', createBuffet)` |
| 28 | PUT | `/:id` | - | - | `router.put('/:id', updateBuffet)` |
| 31 | POST | `/:id/open` | - | - | `router.post('/:id/open', openBuffet)` |
| 32 | POST | `/:id/close` | - | - | `router.post('/:id/close', closeBuffet)` |
| 33 | POST | `/:id/cancel` | - | - | `router.post('/:id/cancel', cancelBuffet)` |
| 36 | POST | `/:id/menu-items` | - | - | `router.post('/:id/menu-items', addMenuItems)` |
| 37 | DELETE | `/:id/menu-items/:itemId` | - | - | `router.delete('/:id/menu-items/:itemId', removeMenuItem)` |

## backend/src/routes/cashier-clearance.routes.ts

Imports: ../controllers/cashier-clearance.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 13 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 16 | GET | `/clearances` | authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.get( '/clearances', authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), getCashierClearances )` |
| 22 | GET | `/:id/shift-summary` | authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.get( '/:id/shift-summary', authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), getCashierShiftSummary )` |
| 28 | POST | `/clearances/:id/approve` | authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post( '/clearances/:id/approve', authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), approveCashierClearance )` |
| 34 | POST | `/clearances/:id/flag` | authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post( '/clearances/:id/flag', authorize([UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), flagCashierClearance )` |

## backend/src/routes/cashier.routes.ts

Imports: ../controllers/cashier-shifts.controller<br>../controllers/cashier.controller<br>../middleware/auth<br>../models/User<br>../utils/logger<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 49 | USE | `(middleware)` | authenticate | - | `router.use(authenticate)` |
| 52 | USE | `(middleware)` | - | - | `router.use((req: any, res, next) => { const allowedRoles = [ 'cashier', 'super_admin', 'accountant', 'branch_accountant', 'receptionist', 'branch_manager', 'bartender', 'waiter', 'restaurant_manager', 'auditor', 'general_manager', 'director', 'hr_manager', 'fi` |
| 86 | GET | `/logbook/today` | - | - | `router.get('/logbook/today', getCashierLogbookToday)` |
| 87 | POST | `/logbook` | - | - | `router.post('/logbook', saveCashierLogbook)` |
| 88 | POST | `/logbook/:id/submit` | - | - | `router.post('/logbook/:id/submit', submitLogbookForAudit)` |
| 89 | GET | `/logbook/pending` | authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.FI) | - | `router.get('/logbook/pending', authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.FINANCE_MANAGER, UserRole.NIGHT_AUDITOR] as any), getLogbooks` |
| 90 | POST | `/logbook/:id/audit` | authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.FI) | - | `router.post('/logbook/:id/audit', authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.FINANCE_MANAGER, UserRole.NIGHT_AUDITOR] as any), auditLog` |
| 97 | GET | `/bill/:bookingId` | - | - | `router.get('/bill/:bookingId', getBillDetails)` |
| 100 | POST | `/pay` | - | - | `router.post('/pay', processCashierPayment)` |
| 103 | POST | `/verify-payment/:paymentId` | - | - | `router.post('/verify-payment/:paymentId', verifyPayment)` |
| 112 | POST | `/pos/transactions/:id/pay` | - | - | `router.post('/pos/transactions/:id/pay', initiatePOSTransactionPayment)` |
| 113 | GET | `/pos/reconciliation` | - | - | `router.get('/pos/reconciliation', getPOSReconciliation)` |
| 119 | GET | `/unpaid-orders` | - | - | `router.get('/unpaid-orders', getUnpaidWaiterOrders)` |
| 120 | PATCH | `/unpaid-orders/:source/:id/pay` | - | - | `router.patch('/unpaid-orders/:source/:id/pay', markWaiterOrderPaid)` |
| 139 | GET | `/unpaid-bills/:id/pdf` | - | - | `router.get('/unpaid-bills/:id/pdf', downloadCustomerCreditInvoice)` |
| 140 | GET | `/unpaid-bills/outstanding/pdf` | - | - | `router.get('/unpaid-bills/outstanding/pdf', downloadCustomerCreditOutstandingReport)` |

## backend/src/routes/catering-bookings.routes.ts

Imports: ../controllers/catering-bookings.controller<br>../middleware/auth.middleware<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 18 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 21 | GET | `/` | authorize('receptionist', 'branch_manager', 'super_admin') | - | `router.get('/', authorize('receptionist', 'branch_manager', 'super_admin'), getCateringBookings)` |
| 22 | GET | `/calendar` | authorize('receptionist', 'branch_manager', 'super_admin') | - | `router.get('/calendar', authorize('receptionist', 'branch_manager', 'super_admin'), getCateringCalendar)` |
| 23 | GET | `/statistics` | authorize('branch_manager', 'super_admin', 'accountant') | - | `router.get('/statistics', authorize('branch_manager', 'super_admin', 'accountant'), getCateringStatistics)` |
| 24 | GET | `/:id` | authorize('receptionist', 'branch_manager', 'super_admin') | - | `router.get('/:id', authorize('receptionist', 'branch_manager', 'super_admin'), getCateringBookingById)` |
| 25 | POST | `/` | authorize('receptionist', 'branch_manager', 'super_admin') | - | `router.post('/', authorize('receptionist', 'branch_manager', 'super_admin'), createCateringBooking)` |
| 26 | PUT | `/:id` | authorize('receptionist', 'branch_manager', 'super_admin') | - | `router.put('/:id', authorize('receptionist', 'branch_manager', 'super_admin'), updateCateringBooking)` |
| 27 | POST | `/:id/cancel` | authorize('receptionist', 'branch_manager', 'super_admin') | - | `router.post('/:id/cancel', authorize('receptionist', 'branch_manager', 'super_admin'), cancelCateringBooking)` |
| 28 | DELETE | `/:id` | authorize('super_admin') | - | `router.delete('/:id', authorize('super_admin'), deleteCateringBooking)` |
| 31 | POST | `/:id/payment` | authorize('receptionist', 'cashier', 'branch_manager', 'super_admin') | - | `router.post('/:id/payment', authorize('receptionist', 'cashier', 'branch_manager', 'super_admin'), recordCateringPayment)` |

## backend/src/routes/catering.routes.ts

Imports: ../controllers/catering.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 22 | USE | `(middleware)` | - | - | `router.use(authenticateToken)` |
| 25 | GET | `/events` | - | - | `router.get('/events', getCateringEvents)` |
| 26 | GET | `/events/:id` | - | - | `router.get('/events/:id', getCateringEvent)` |
| 27 | POST | `/events` | - | - | `router.post('/events', createCateringEvent)` |
| 28 | PUT | `/events/:id` | - | - | `router.put('/events/:id', updateCateringEvent)` |
| 31 | POST | `/events/:id/allocate-stock` | - | - | `router.post('/events/:id/allocate-stock', allocateStock)` |
| 32 | POST | `/events/:id/record-actual` | - | - | `router.post('/events/:id/record-actual', recordActual)` |
| 33 | POST | `/events/:id/complete` | - | - | `router.post('/events/:id/complete', completeEvent)` |
| 34 | POST | `/events/:id/cancel` | - | - | `router.post('/events/:id/cancel', cancelEvent)` |
| 37 | POST | `/events/:id/menu-items` | - | - | `router.post('/events/:id/menu-items', addMenuItems)` |

## backend/src/routes/channelManager.routes.ts

Imports: ../controllers/channelManager.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 18 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 24 | GET | `/` | - | - | `router.get('/', getChannels)` |
| 25 | GET | `/status` | - | - | `router.get('/status', getSyncStatus)` |
| 28 | PUT | `/:channelId/configure` | authorize(managerRoles) | - | `router.put('/:channelId/configure', authorize(managerRoles), configureChannel)` |
| 29 | PATCH | `/:channelId/toggle` | authorize(managerRoles) | - | `router.patch('/:channelId/toggle', authorize(managerRoles), toggleChannel)` |
| 32 | POST | `/:channelId/push-availability` | authorize(managerRoles) | - | `router.post('/:channelId/push-availability', authorize(managerRoles), pushAvailability)` |
| 33 | POST | `/:channelId/push-rates` | authorize(managerRoles) | - | `router.post('/:channelId/push-rates', authorize(managerRoles), pushRates)` |
| 34 | POST | `/:channelId/pull-bookings` | authorize(managerRoles) | - | `router.post('/:channelId/pull-bookings', authorize(managerRoles), pullBookings)` |
| 37 | POST | `/sync-all` | authorize(managerRoles) | - | `router.post('/sync-all', authorize(managerRoles), syncAllChannels)` |
| 40 | POST | `/import-booking` | authorize(managerRoles) | - | `router.post('/import-booking', authorize(managerRoles), importBooking)` |

## backend/src/routes/communication.routes.ts

Imports: ../controllers/communication.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 17 | GET | `/health` | - | - | `router.get('/health', healthCheck)` |
| 20 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 23 | POST | `/booking-confirmation` | - | - | `router.post('/booking-confirmation', sendBookingConfirmation)` |
| 24 | POST | `/check-in-reminder` | - | - | `router.post('/check-in-reminder', sendCheckInReminder)` |
| 25 | POST | `/invoice` | - | - | `router.post('/invoice', sendInvoice)` |
| 28 | POST | `/email` | - | - | `router.post('/email', sendCustomEmail)` |
| 29 | POST | `/sms` | - | - | `router.post('/sms', sendCustomSMS)` |
| 32 | POST | `/sms/bulk` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]) | - | `router.post('/sms/bulk', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), sendBulkSMS)` |
| 35 | GET | `/log` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]) | - | `router.get('/log', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), getMessageLog)` |

## backend/src/routes/communications.routes.ts

Imports: ../controllers/communications.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 9 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 12 | GET | `/channels` | - | - | `router.get('/channels', CommunicationsController.getChannels)` |
| 13 | POST | `/channels` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.post('/channels', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), CommunicationsController.createChannel )` |
| 17 | GET | `/channels/:channelId/members` | - | - | `router.get('/channels/:channelId/members', CommunicationsController.getChannelMembers)` |
| 18 | POST | `/channels/:channelId/members` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.post('/channels/:channelId/members', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), CommunicationsController.addMembers )` |
| 24 | GET | `/channels/:channelId/messages` | - | - | `router.get('/channels/:channelId/messages', CommunicationsController.getMessages)` |
| 25 | POST | `/channels/:channelId/messages` | - | - | `router.post('/channels/:channelId/messages', CommunicationsController.sendMessage)` |
| 26 | PATCH | `/messages/:messageId` | - | - | `router.patch('/messages/:messageId', CommunicationsController.updateMessage)` |
| 27 | DELETE | `/messages/:messageId` | - | - | `router.delete('/messages/:messageId', CommunicationsController.deleteMessage)` |
| 30 | POST | `/messages/:messageId/react` | - | - | `router.post('/messages/:messageId/react', CommunicationsController.reactToMessage)` |
| 33 | POST | `/channels/:channelId/read` | - | - | `router.post('/channels/:channelId/read', CommunicationsController.markAsRead)` |
| 36 | GET | `/users` | - | - | `router.get('/users', CommunicationsController.getUsers)` |
| 39 | POST | `/upload` | - | - | `router.post('/upload', CommunicationsController.uploadFile)` |

## backend/src/routes/conference.routes.ts

Imports: ../controllers/conference-attendance.controller<br>../controllers/conference.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 27 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 30 | GET | `/halls` | - | - | `router.get('/halls', getHalls)` |
| 31 | GET | `/halls/:id/availability` | - | - | `router.get('/halls/:id/availability', checkHallAvailability)` |
| 32 | POST | `/halls` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]) | - | `router.post('/halls', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), createHall)` |
| 33 | PATCH | `/halls/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]) | - | `router.patch('/halls/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), updateHall)` |
| 34 | POST | `/halls/auto-update-status` | - | - | `router.post('/halls/auto-update-status', autoUpdateHallStatuses)` |
| 37 | GET | `/bookings` | - | - | `router.get('/bookings', getConferenceBookings)` |
| 38 | GET | `/bookings/by-invoice/:invoice_number` | - | - | `router.get('/bookings/by-invoice/:invoice_number', getConferenceBookings)` |
| 39 | POST | `/bookings` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]) | - | `router.post('/bookings', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), createConferenceBooking)` |
| 40 | PATCH | `/bookings/:id/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]) | - | `router.patch('/bookings/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), updateConferenceBookingStatus)` |
| 41 | GET | `/bookings/:id/invoice` | - | - | `router.get('/bookings/:id/invoice', getBookingInvoice)` |
| 42 | POST | `/bookings/:id/payments` | - | - | `router.post('/bookings/:id/payments', addConferencePayment)` |
| 45 | POST | `/bookings/:id/attendance` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/bookings/:id/attendance', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), recordDailyAttendance)` |
| 46 | GET | `/bookings/:id/attendance` | - | - | `router.get('/bookings/:id/attendance', getDailyAttendance)` |
| 47 | GET | `/bookings/:id/invoice-with-attendance` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/bookings/:id/invoice-with-attendance', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), generateInvoiceWithAttendance)` |
| 48 | DELETE | `/bookings/:id/attendance/:date` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]) | - | `router.delete('/bookings/:id/attendance/:date', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), deleteDailyAttendance)` |

## backend/src/routes/credit.routes.ts

Imports: ../controllers/credit.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 7 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 10 | PUT | `/:type/:id/confirm` | authorize(['accountant', 'auditor', 'super_admin'] as any) | - | `router.put('/:type/:id/confirm', authorize(['accountant', 'auditor', 'super_admin'] as any), confirmCreditBill)` |
| 13 | GET | `/pending/:role` | authorize(['accountant', 'auditor', 'super_admin'] as any) | - | `router.get('/pending/:role', authorize(['accountant', 'auditor', 'super_admin'] as any), getPendingConfirmations)` |

## backend/src/routes/dispatch.routes.ts

Imports: ../controllers/dispatch/auditor.controller<br>../controllers/dispatch/dispatches.controller<br>../controllers/dispatch/items.controller<br>../controllers/dispatch/otp.controller<br>../controllers/dispatch/pos.controller<br>../controllers/dispatch/tracking.controller<br>../middleware/auth<br>../models/User<br>express<br>multer

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 75 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 105 | GET | `/dashboard/central` | authorize(centralRoles) | - | `router.get('/dashboard/central', authorize(centralRoles), getCentralDashboard)` |
| 112 | POST | `/items/receive` | authorize(centralRoles) | - | `router.post('/items/receive', authorize(centralRoles), receiveItem)` |
| 115 | GET | `/items` | authorize(allStoreRoles) | - | `router.get('/items', authorize(allStoreRoles), getItems)` |
| 118 | GET | `/barcodes/:barcode` | authorize(allStoreRoles) | - | `router.get('/barcodes/:barcode', authorize(allStoreRoles), searchByBarcode)` |
| 121 | POST | `/barcodes/generate` | authorize(centralRoles) | - | `router.post('/barcodes/generate', authorize(centralRoles), generateBarcode)` |
| 124 | POST | `/barcodes/:barcode/print` | authorize(centralRoles) | - | `router.post('/barcodes/:barcode/print', authorize(centralRoles), printBarcodeLabel)` |
| 131 | POST | `/dispatches` | authorize(centralRoles) | - | `router.post('/dispatches', authorize(centralRoles), createDispatch)` |
| 134 | GET | `/dispatches` | authorize(allDispatchRoles) | - | `router.get('/dispatches', authorize(allDispatchRoles), getDispatches)` |
| 137 | GET | `/dispatches/:id` | authorize(allDispatchRoles) | - | `router.get('/dispatches/:id', authorize(allDispatchRoles), getDispatchById)` |
| 144 | POST | `/dispatches/:id/verify-driver-otp` | authorize(driverRoles) | - | `router.post('/dispatches/:id/verify-driver-otp', authorize(driverRoles), verifyDriverOtp)` |
| 147 | POST | `/dispatches/:id/verify-branch-otp` | authorize(branchRoles) | - | `router.post('/dispatches/:id/verify-branch-otp', authorize(branchRoles), verifyBranchOtp)` |
| 154 | POST | `/dispatches/:id/generate-otp` | authorize(centralRoles) | - | `router.post('/dispatches/:id/generate-otp', authorize(centralRoles), generateOTP)` |
| 157 | POST | `/dispatches/:id/verify-otp` | authorize(branchRoles) | - | `router.post('/dispatches/:id/verify-otp', authorize(branchRoles), verifyOTP)` |
| 160 | GET | `/dispatches/:id/otp` | authorize([...centralRoles, ...branchRoles]) | - | `router.get('/dispatches/:id/otp', authorize([...centralRoles, ...branchRoles]), getOTP)` |
| 163 | POST | `/otps/cleanup` | authorize([UserRole.SUPER_ADMIN]) | - | `router.post('/otps/cleanup', authorize([UserRole.SUPER_ADMIN]), cleanupExpiredOTPs)` |
| 170 | POST | `/dispatches/:id/location` | authorize(driverRoles) | - | `router.post('/dispatches/:id/location', authorize(driverRoles), updateDispatchLocation)` |
| 173 | GET | `/dispatches/:id/location` | authorize(allStoreRoles) | - | `router.get('/dispatches/:id/location', authorize(allStoreRoles), getDispatchLocation)` |
| 176 | GET | `/tracking/active` | authorize(centralRoles) | - | `router.get('/tracking/active', authorize(centralRoles), getActiveDispatchesWithLocation)` |
| 183 | POST | `/dispatches/:id/upload-document` | authorize(branchRoles) | upload | `router.post( '/dispatches/:id/upload-document', authorize(branchRoles), upload.single('document'), uploadDocument )` |
| 191 | GET | `/dispatches/:id/documents` | authorize(allStoreRoles) | - | `router.get('/dispatches/:id/documents', authorize(allStoreRoles), getDispatchDocuments)` |
| 198 | GET | `/auditor/deliveries` | authorize(auditorRoles) | - | `router.get('/auditor/deliveries', authorize(auditorRoles), getAuditorDeliveries)` |
| 201 | GET | `/auditor/deliveries/:id` | authorize(auditorRoles) | - | `router.get('/auditor/deliveries/:id', authorize(auditorRoles), getAuditorDeliveryDetail)` |
| 204 | POST | `/auditor/deliveries/:id/review` | authorize(auditorRoles) | - | `router.post('/auditor/deliveries/:id/review', authorize(auditorRoles), reviewDelivery)` |
| 211 | POST | `/pos/barcodes/generate` | authorize(cashierRoles) | - | `router.post('/pos/barcodes/generate', authorize(cashierRoles), generatePosBarcode)` |
| 214 | GET | `/pos/barcodes/scan/:barcode` | authorize(cashierRoles) | - | `router.get('/pos/barcodes/scan/:barcode', authorize(cashierRoles), scanPosBarcode)` |

## backend/src/routes/document.routes.ts

Imports: ../controllers/document.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 8 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 10 | POST | `/upload` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]) | upload | `router.post('/upload', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]), upload.single('file'), uploadDocument )` |
| 16 | GET | `/guest/:guestId` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]) | - | `router.get('/guest/:guestId', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]), getGuestDocuments )` |
| 21 | DELETE | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.delete('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), deleteDocument )` |

## backend/src/routes/email.routes.ts

Imports: ../controllers/email.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 17 | POST | `/password-reset` | - | - | `router.post('/password-reset', sendPasswordResetEmail)` |
| 20 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 23 | GET | `/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.get('/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), getEmailServiceStatus )` |
| 28 | POST | `/test` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/test', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), sendTestEmail )` |
| 34 | POST | `/welcome` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]) | - | `router.post('/welcome', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), sendWelcomeEmail )` |
| 40 | POST | `/booking-confirmation` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]) | - | `router.post('/booking-confirmation', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), sendBookingConfirmationEmail )` |
| 46 | POST | `/maintenance-alert` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.MAINTENANCE]) | - | `router.post('/maintenance-alert', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.MAINTENANCE]), sendMaintenanceAlertEmail )` |
| 52 | POST | `/inventory-alert` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]) | - | `router.post('/inventory-alert', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), sendInventoryAlertEmail )` |

## backend/src/routes/employee-portal.routes.ts

Imports: ../config/supabase<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 10 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 17 | GET | `/dashboard` | - | upload | `router.get('/dashboard', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'Unauthorized' }); } // Get employee profile const { data: profile, error: profi` |
| 111 | GET | `/profile` | - | upload | `router.get('/profile', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'Unauthorized' }); } const { data: user } = await supabase .from('users') .select(` |
| 141 | PUT | `/profile` | - | - | `router.put('/profile', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'Unauthorized' }); } const { phone_number, address, emergency_contact } = req.body` |
| 174 | GET | `/schedules` | - | upload | `router.get('/schedules', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { start_date, end_date } = req.query; const { data: profile } = await supabase .from('staff_profiles') .select('id') .eq('user_id', userId) .sin` |
| 209 | POST | `/clock` | - | upload | `router.post('/clock', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { action, notes } = req.body; if (!userId) { return res.status(401).json({ success: false, message: 'Unauthorized' }); } const { data: user } = awa` |
| 289 | GET | `/time-clock` | - | - | `router.get('/time-clock', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { start_date, end_date } = req.query; let query = supabase .from('employee_time_clock') .select('*') .eq('user_id', userId) .order('clock_in', ` |
| 314 | GET | `/leave` | - | upload | `router.get('/leave', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data: profile } = await supabase .from('staff_profiles') .select('id') .eq('user_id', userId) .single(); if (!profile) { return res.json({ success` |
| 343 | POST | `/leave` | - | upload | `router.post('/leave', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { leave_type, start_date, end_date, reason } = req.body; const { data: profile } = await supabase .from('staff_profiles') .select('id') .eq('user_i` |
| 380 | DELETE | `/leave/:id` | - | upload | `router.delete('/leave/:id', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { id } = req.params; const { data: profile } = await supabase .from('staff_profiles') .select('id') .eq('user_id', userId) .single(); const {` |
| 407 | GET | `/tasks` | - | - | `router.get('/tasks', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { status } = req.query; let query = supabase .from('employee_tasks') .select('*') .eq('user_id', userId) .order('due_date', { ascending: true }); if` |
| 433 | PUT | `/tasks/:id` | - | upload | `router.put('/tasks/:id', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { id } = req.params; const { status, notes } = req.body; const updateData: any = { status, updated_at: new Date().toISOString() }; if (status ==` |
| 462 | GET | `/payslips` | - | upload | `router.get('/payslips', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data: profile } = await supabase .from('staff_profiles') .select('id') .eq('user_id', userId) .single(); if (!profile) { return res.json({ succ` |
| 492 | GET | `/documents` | - | - | `router.get('/documents', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { type } = req.query; let query = supabase .from('employee_documents') .select('*') .eq('user_id', userId) .order('created_at', { ascending: fal` |
| 518 | GET | `/announcements` | - | upload | `router.get('/announcements', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data: user } = await supabase .from('users') .select('branch_id') .eq('id', userId) .single(); const { data, error } = await supabase .fro` |
| 544 | GET | `/training` | - | - | `router.get('/training', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data, error } = await supabase .from('employee_training') .select('*') .eq('user_id', userId) .order('due_date', { ascending: true }); if (erro` |
| 563 | GET | `/performance` | - | upload | `router.get('/performance', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data: profile } = await supabase .from('staff_profiles') .select('id') .eq('user_id', userId) .single(); if (!profile) { return res.json({ s` |

## backend/src/routes/facilities.routes.ts

Imports: ../config/pg<br>../middleware/auth<br>../models/User<br>../utils/logger<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 19 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 22 | GET | `/dashboard` | authorize(ALL_FACILITIES_ROLES) | - | `router.get('/dashboard', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const stats = { rooms: { total: 25, clean: 18, dirty: 5, outOfOrder: 2, inspected: 15 }` |
| 39 | GET | `/rooms` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/rooms', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(`SELECT id, room_number, floor, room_type, status FROM room` |
| 51 | GET | `/staff/list` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/staff/list', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const department = req.query.department as string; let query = ` SELECT sp.id, sp.depa` |
| 82 | GET | `/equipment/list` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/equipment/list', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT id, name, location, status FROM maintenan` |
| 98 | GET | `/supplies/list` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/supplies/list', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const result = await pool.query(` SELECT hs.id, hs.name, hs.current_stock, hs.minimum_stock, hsc.name as category_name FROM housekeeping_supplies hs LE` |
| 114 | GET | `/housekeeping/tasks` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/housekeeping/tasks', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT ht.*, r.room_number FROM housekeeping` |
| 129 | POST | `/housekeeping/tasks` | authorize(ALL_FACILITIES_ROLES) | query() | `router.post('/housekeeping/tasks', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const { room_id, room_number, task_type, priority, assigned_to, notes, due_date, branch_id } = req.body; const userId = (req as any).user?.id; co` |
| 165 | PUT | `/housekeeping/tasks/:id/status` | authorize(ALL_FACILITIES_ROLES) | query() | `router.put('/housekeeping/tasks/:id/status', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const { id } = req.params; const { status } = req.body; const result = await pool.query( `UPDATE housekeeping_tasks SET status = $1:: t` |
| 180 | GET | `/housekeeping/inspections` | authorize(SUPERVISOR_ROLES) | query() | `router.get('/housekeeping/inspections', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT hi.*, r.room_number, sp.first_name ` |
| 197 | POST | `/housekeeping/inspections` | authorize(SUPERVISOR_ROLES) | query() | `router.post('/housekeeping/inspections', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => { try { const { room_number, cleanliness_score, maintenance_score, amenities_score, notes, overall_score, branch_id } = req.body; const userId = (req a` |
| 236 | GET | `/housekeeping/lost-found` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/housekeeping/lost-found', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT lf.*, r.room_number FROM hk_lost` |
| 253 | POST | `/housekeeping/lost-found` | authorize(ALL_FACILITIES_ROLES) | query() | `router.post('/housekeeping/lost-found', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const { item_name, description, location_found, category, found_by, branch_id } = req.body; const userId = (req as any).user?.id; // Find st` |
| 276 | PUT | `/housekeeping/lost-found/:id/status` | authorize(ALL_FACILITIES_ROLES) | query() | `router.put('/housekeeping/lost-found/:id/status', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const { id } = req.params; const { status } = req.body; const result = await pool.query(`UPDATE hk_lost_found SET status = $1:: hk` |
| 288 | GET | `/maintenance/work-orders` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/maintenance/work-orders', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT wo.*, sp.first_name \|\| ' ' \|\| sp` |
| 304 | POST | `/maintenance/work-orders` | authorize(ALL_FACILITIES_ROLES) | query() | `router.post('/maintenance/work-orders', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const { title, description, location, category, priority, assigned_to, branch_id } = req.body; const userId = (req as any).user?.id; // Gene` |
| 330 | PUT | `/maintenance/work-orders/:id/status` | authorize(ALL_FACILITIES_ROLES) | query() | `router.put('/maintenance/work-orders/:id/status', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const { id } = req.params; const { status } = req.body; const result = await pool.query( `UPDATE maintenance_work_orders SET statu` |
| 345 | GET | `/maintenance/assets` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/maintenance/assets', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT * FROM maintenance_assets WHERE($1:: ` |
| 360 | POST | `/maintenance/assets` | authorize(SUPERVISOR_ROLES) | query() | `router.post('/maintenance/assets', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => { try { const { name, category, location, serial_number, purchase_date, warranty_expiry, notes, branch_id } = req.body; // Generate asset tag const dateStr =` |
| 382 | GET | `/maintenance/schedule` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/maintenance/schedule', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT ms.*, me.name as equipment_name, me` |
| 398 | POST | `/maintenance/schedule` | authorize(SUPERVISOR_ROLES) | query() | `router.post('/maintenance/schedule', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => { try { const { title, asset_name, equipment_name, maintenance_type, description, frequency, scheduled_date, next_due, assigned_to, branch_id } = req.body;` |
| 429 | PUT | `/maintenance/schedule/:id/status` | authorize(ALL_FACILITIES_ROLES) | query() | `router.put('/maintenance/schedule/:id/status', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const { id } = req.params; const result = await pool.query( `UPDATE maintenance_schedules SET last_performed = NOW(), next_due = NOW(` |
| 443 | GET | `/staff` | authorize(SUPERVISOR_ROLES) | query() | `router.get('/staff', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT sp.*, COALESCE(sp.first_name \|\| ' ' \|\| sp.last_name, u` |
| 461 | POST | `/staff` | authorize(SUPERVISOR_ROLES) | query() | `router.post('/staff', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => { try { const { name, first_name, last_name, national_id, id_number, email, phone, department, position, role, shift, salary, start_date, branch_id } = req.body; // Deter` |
| 498 | GET | `/inventory` | authorize(ALL_FACILITIES_ROLES) | query() | `router.get('/inventory', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; const result = await pool.query(` SELECT hs.*, hsc.name as category_name FROM housekeep` |
| 514 | POST | `/inventory/requests` | authorize(ALL_FACILITIES_ROLES) | query() | `router.post('/inventory/requests', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => { try { const { supply_id, item_name, quantity, urgency, notes, branch_id } = req.body; const userId = (req as any).user?.id; // Find supply by name if s` |
| 555 | GET | `/quality-compliance` | authorize(SUPERVISOR_ROLES) | query() | `router.get('/quality-compliance', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => { try { const branchId = req.query.branch_id \|\| req.headers['x-branch-id']; // Get real inspection stats let inspectionStats = { total: 0, passed: 0, avgScore` |

## backend/src/routes/finance.routes.ts

Imports: ../config/database<br>../controllers/director-enhanced.controller<br>../controllers/director-tasks.controller<br>../controllers/director.controller<br>../controllers/discrepancies.controller<br>../controllers/finance.controller<br>../controllers/financial-workspace.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 46 | GET | `/branches` | - | - | `router.get('/branches', async (req, res) => { try { const { data, error } = await supabase.from('branches').select('id, name, code'); if (error) throw error; res.json({ success: true, data: data \|\| [] }); } catch (error: any) { console.error('Get branches erro` |
| 58 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 61 | GET | `/invoices/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]) | - | `router.get('/invoices/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]), getInvoices )` |
| 67 | GET | `/invoices` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]) | - | `router.get('/invoices', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]), getInvoices )` |
| 72 | POST | `/payments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]) | - | `router.post('/payments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.RECEPTIONIST]), processPayment )` |
| 78 | GET | `/transactions` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/transactions', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getTransactions )` |
| 83 | POST | `/transactions` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/transactions', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createTransaction )` |
| 88 | POST | `/invoices` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/invoices', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createInvoice )` |
| 93 | GET | `/overview` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/overview', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getFinancialOverview )` |
| 99 | GET | `/dashboard` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER]) | - | `router.get('/dashboard', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER]), getFinancialOverview )` |
| 112 | PUT | `/expenses/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/expenses/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), approveExpense )` |
| 118 | GET | `/daily-logs` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/daily-logs', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getDailyLogs )` |
| 123 | POST | `/daily-logs` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/daily-logs', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), saveDailyLog )` |
| 128 | PUT | `/daily-logs/:id/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.put('/daily-logs/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), updateDailyLogStatus )` |
| 135 | GET | `/workspace/daily` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/workspace/daily', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getDailyRecords )` |
| 140 | GET | `/workspace/daily/:date` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/workspace/daily/:date', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getDailyRecordByDate )` |
| 145 | POST | `/workspace/daily` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/workspace/daily', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), saveDailyRecord )` |
| 150 | GET | `/workspace/monthly` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/workspace/monthly', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getMonthlyAdjustments )` |
| 155 | POST | `/workspace/monthly` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/workspace/monthly', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), saveMonthlyAdjustment )` |
| 160 | GET | `/workspace/export` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.DIRECTOR]) | - | `router.get('/workspace/export', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.DIRECTOR]), exportMonthlyStatement )` |
| 168 | GET | `/cashflow` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/cashflow', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getCashFlowReport )` |
| 174 | GET | `/profit-loss` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/profit-loss', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getProfitLossStatement )` |
| 180 | GET | `/revenue-by-branch` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/revenue-by-branch', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getRevenueByBranch )` |
| 186 | GET | `/budget-analysis` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/budget-analysis', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getBudgetAnalysis )` |
| 192 | GET | `/tax-summary` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/tax-summary', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getTaxSummary )` |
| 198 | GET | `/forecast` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/forecast', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getFinancialForecast )` |
| 204 | GET | `/ar-ap` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/ar-ap', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getAccountsReceivablePayable )` |
| 210 | GET | `/kpis` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/kpis', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getFinancialKPIs )` |
| 216 | GET | `/branch-financials/:branchId` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/branch-financials/:branchId', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), getBranchFinancialProfile )` |
| 224 | GET | `/balance-sheet` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/balance-sheet', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { // Proxy to Python service or implement locally const axios = require('axios'); const pythonU` |
| 241 | GET | `/trial-balance` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/trial-balance', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'https://` |
| 257 | GET | `/journal-entries` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/journal-entries', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'https:` |
| 272 | POST | `/journal-entries` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/journal-entries', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'https` |
| 288 | GET | `/financial-ratios` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/financial-ratios', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'https` |
| 304 | GET | `/aging-report` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/aging-report', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'https://s` |
| 320 | GET | `/expense-breakdown` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/expense-breakdown', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'http` |
| 336 | GET | `/revenue-analysis` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/revenue-analysis', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'https` |
| 352 | GET | `/comparative-analysis` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/comparative-analysis', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'h` |
| 368 | POST | `/reports/generate` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/reports/generate', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), async (req, res) => { try { const axios = require('axios'); const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'http` |
| 384 | GET | `/branches` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.get('/branches', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), async (req, res) => { try { const { data, error } = await supabase.from('branches')` |
| 399 | GET | `/director/overview` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/overview', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorController.getGlobalOverview )` |
| 405 | GET | `/director/comprehensive` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/comprehensive', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorEnhancedController.getComprehensiveDashboard )` |
| 410 | GET | `/director/payment-breakdown` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/payment-breakdown', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorEnhancedController.getPaymentBreakdown )` |
| 415 | GET | `/director/banking-reconciliation` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/banking-reconciliation', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorEnhancedController.getBankingReconciliation )` |
| 420 | GET | `/director/export-pdf` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/export-pdf', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorEnhancedController.exportPDFReport )` |
| 425 | GET | `/director/payments` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/payments', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorController.getPaymentIntelligence )` |
| 430 | GET | `/director/banking` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/banking', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorController.getBankingControl )` |
| 435 | GET | `/director/visuals` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/visuals', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorController.getVisualData )` |
| 441 | GET | `/director/drill-down` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.get('/director/drill-down', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]), DirectorEnhancedController.getDrillDownData )` |
| 452 | GET | `/director/tasks/staff` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/director/tasks/staff', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]), DirectorTasksController.getBranchStaff )` |
| 456 | GET | `/director/tasks` | authorize(TASK_ROLES) | - | `router.get('/director/tasks', authorize(TASK_ROLES), DirectorTasksController.getTasks)` |
| 457 | POST | `/director/tasks` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]) | - | `router.post('/director/tasks', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]), DirectorTasksController.createTask )` |
| 461 | PATCH | `/director/tasks/:id/respond` | authorize(TASK_ROLES) | - | `router.patch('/director/tasks/:id/respond', authorize(TASK_ROLES), DirectorTasksController.respondToTask)` |
| 462 | PATCH | `/director/tasks/:id/close` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]) | - | `router.patch('/director/tasks/:id/close', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]), DirectorTasksController.closeTask )` |
| 468 | GET | `/discrepancies/export` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]) | - | `router.get('/discrepancies/export', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]), DiscrepancyController.exportAuditReport )` |
| 473 | GET | `/discrepancies` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER, UserRole.AUDITOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/discrepancies', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER, UserRole.AUDITOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), DiscrepancyController.getFlags )` |
| 478 | POST | `/discrepancies` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.AUDITOR]) | - | `router.post('/discrepancies', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.AUDITOR]), DiscrepancyController.createFlag )` |
| 483 | PATCH | `/discrepancies/:id/respond` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.patch('/discrepancies/:id/respond', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), DiscrepancyController.respondToFlag )` |
| 488 | PATCH | `/discrepancies/:id/finalize` | authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]) | - | `router.patch('/discrepancies/:id/finalize', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR]), DiscrepancyController.finalizeFlag )` |

## backend/src/routes/fleet.routes.ts

Imports: ../controllers/fleet.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 14 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 24 | GET | `/vehicles/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]) | - | `router.get('/vehicles/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), getVehicle )` |
| 33 | POST | `/assignments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/assignments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), assignVehicle )` |

## backend/src/routes/folio.routes.ts

Imports: ../controllers/folio.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 8 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 10 | GET | `/reservation/:reservationId` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.get('/reservation/:reservationId', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), getFolio )` |
| 15 | POST | `/reservation/:reservationId/transaction` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.post('/reservation/:reservationId/transaction', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), addTransaction )` |

## backend/src/routes/foodControl.routes.ts

Imports: ../controllers/foodControlVariance.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 21 | USE | `(middleware)` | - | - | `router.use(authenticateToken)` |
| 24 | GET | `/variance/shift/:shiftId` | - | - | `router.get('/variance/shift/:shiftId', getShiftVarianceReport)` |
| 25 | POST | `/variance/compute` | - | - | `router.post('/variance/compute', computeShiftVariance)` |
| 26 | GET | `/variance/pending` | - | - | `router.get('/variance/pending', getPendingVariances)` |
| 27 | GET | `/variance/stats` | - | - | `router.get('/variance/stats', getVarianceStats)` |
| 30 | POST | `/variance/:id/explain` | - | - | `router.post('/variance/:id/explain', explainVarianceItem)` |
| 31 | POST | `/variance/:id/flag` | - | - | `router.post('/variance/:id/flag', flagVarianceItem)` |
| 32 | POST | `/variance/:id/approve` | - | - | `router.post('/variance/:id/approve', approveVariance)` |
| 35 | GET | `/portion-output/shift/:shiftId` | - | - | `router.get('/portion-output/shift/:shiftId', getShiftPortionOutput)` |

## backend/src/routes/guest-portal.routes.ts

Imports: ../config/supabase<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 11 | GET | `/dashboard` | - | upload | `router.get('/dashboard', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'Unauthorized' }); } // Get guest profile const { data: profile } = await supaba` |
| 99 | GET | `/profile` | - | upload | `router.get('/profile', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'Unauthorized' }); } const { data: user } = await supabase .from('users') .select(` |
| 134 | PUT | `/profile` | - | - | `router.put('/profile', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'Unauthorized' }); } const { phone_number, address, nationality, company } = req.b` |
| 167 | GET | `/bookings` | - | - | `router.get('/bookings', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { status, upcoming } = req.query; let query = supabase .from('bookings') .select(` *, room:rooms(room_number, floor, type:room_types(name, descri` |
| 201 | GET | `/bookings/:id` | - | upload | `router.get('/bookings/:id', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { id } = req.params; const { data, error } = await supabase .from('bookings') .select(` *, room:rooms(room_number, floor, type:room_types(nam` |
| 225 | POST | `/bookings/:id/cancel` | - | upload | `router.post('/bookings/:id/cancel', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { id } = req.params; const { reason } = req.body; // Check if booking can be cancelled const { data: booking } = await supabase .from` |
| 267 | GET | `/requests` | - | - | `router.get('/requests', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { status } = req.query; let query = supabase .from('guest_requests') .select('*') .eq('guest_id', userId) .order('created_at', { ascending: false` |
| 293 | POST | `/requests` | - | upload | `router.post('/requests', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { request_type, title, description, priority, scheduled_time } = req.body; // Get active booking const { data: activeBooking } = await supabase ` |
| 332 | DELETE | `/requests/:id` | - | - | `router.delete('/requests/:id', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { id } = req.params; const { error } = await supabase .from('guest_requests') .update({ status: 'cancelled', updated_at: new Date().toISOS` |
| 353 | POST | `/requests/:id/rate` | - | - | `router.post('/requests/:id/rate', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { id } = req.params; const { rating, feedback } = req.body; const { error } = await supabase .from('guest_requests') .update({ rating, ` |
| 375 | GET | `/messages` | - | - | `router.get('/messages', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data, error } = await supabase .from('guest_messages') .select('*') .eq('guest_id', userId) .order('created_at', { ascending: false }); if (err` |
| 403 | POST | `/messages` | - | upload | `router.post('/messages', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { subject, message, booking_id } = req.body; const { data: booking } = await supabase .from('bookings') .select('room:rooms(branch_id)') .eq('id` |
| 437 | GET | `/loyalty` | - | upload | `router.get('/loyalty', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data: loyalty } = await supabase .from('guest_loyalty') .select('*') .eq('guest_id', userId) .single(); const { data: transactions } = await sup` |
| 468 | GET | `/amenities` | - | - | `router.get('/amenities', async (req: Request, res: Response) => { try { const { category } = req.query; let query = supabase .from('hotel_amenities') .select('*') .eq('is_active', true) .order('name', { ascending: true }); if (category) { query = query.eq('cat` |
| 493 | POST | `/amenities/:id/book` | - | upload | `router.post('/amenities/:id/book', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { id } = req.params; const { scheduled_date, scheduled_time, duration_minutes, guests_count, special_requests } = req.body; // Get ame` |
| 544 | GET | `/amenity-bookings` | - | - | `router.get('/amenity-bookings', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data, error } = await supabase .from('amenity_bookings') .select(` *, amenity:hotel_amenities(name, category, price) `) .eq('guest_id',` |
| 566 | DELETE | `/amenity-bookings/:id` | - | - | `router.delete('/amenity-bookings/:id', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { id } = req.params; const { error } = await supabase .from('amenity_bookings') .update({ status: 'cancelled', updated_at: new Dat` |
| 587 | POST | `/feedback` | - | upload | `router.post('/feedback', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { booking_id, overall_rating, cleanliness_rating, service_rating, amenities_rating, value_rating, comment, would_recommend } = req.body; // Get ` |
| 635 | GET | `/preferences` | - | - | `router.get('/preferences', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { data, error } = await supabase .from('guest_saved_preferences') .select('*') .eq('guest_id', userId); if (error) throw error; res.json({ suc` |
| 653 | PUT | `/preferences` | - | upload | `router.put('/preferences', async (req: Request, res: Response) => { try { const userId = (req as any).user?.id; const { category, preference_key, preference_value } = req.body; const { data, error } = await supabase .from('guest_saved_preferences') .upsert({ g` |

## backend/src/routes/guest.routes.ts

Imports: ../controllers/guest.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 20 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 22 | GET | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.get('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), getGuests )` |
| 27 | GET | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.get('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), getGuest )` |
| 32 | POST | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.post('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), createGuest )` |
| 37 | PUT | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.put('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), updateGuest )` |
| 42 | PUT | `/:id/preferences` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.put('/:id/preferences', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), updateGuestPreferences )` |
| 47 | DELETE | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]) | - | `router.delete('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), deleteGuest )` |
| 53 | GET | `/vip/list` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.get('/vip/list', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), getVIPGuests )` |
| 59 | GET | `/:id/history` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.get('/:id/history', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), getGuestHistory )` |
| 65 | GET | `/:id/loyalty` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]) | - | `router.get('/:id/loyalty', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]), getGuestLoyalty )` |
| 70 | POST | `/:id/loyalty/points` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/:id/loyalty/points', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateLoyaltyPoints )` |

## backend/src/routes/housekeeping.routes.ts

Imports: ../controllers/housekeeping/dashboard.controller<br>../controllers/housekeeping/enhanced.controller<br>../controllers/housekeeping/guest-requests.controller<br>../controllers/housekeeping/inspections.controller<br>../controllers/housekeeping/linen.controller<br>../controllers/housekeeping/lost-found.controller<br>../controllers/housekeeping/maintenance.controller<br>../controllers/housekeeping/reports.controller<br>../controllers/housekeeping/rooms.controller<br>../controllers/housekeeping/scheduling.controller<br>../controllers/housekeeping/staff.controller<br>../controllers/housekeeping/tasks.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 49 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 54 | GET | `/dashboard` | authorize(ALL_HK_ROLES) | - | `router.get('/dashboard', authorize(ALL_HK_ROLES), dashboardCtrl.getDashboard)` |
| 55 | GET | `/dashboard/room-grid` | authorize(ALL_HK_ROLES) | - | `router.get('/dashboard/room-grid', authorize(ALL_HK_ROLES), dashboardCtrl.getRoomGrid)` |
| 56 | GET | `/dashboard/stats` | authorize(ALL_HK_ROLES) | - | `router.get('/dashboard/stats', authorize(ALL_HK_ROLES), dashboardCtrl.getStats)` |
| 57 | GET | `/dashboard/workload` | authorize(SUPERVISOR_ROLES) | - | `router.get('/dashboard/workload', authorize(SUPERVISOR_ROLES), dashboardCtrl.getWorkloadDistribution)` |
| 62 | GET | `/tasks` | authorize(ALL_HK_ROLES) | - | `router.get('/tasks', authorize(ALL_HK_ROLES), tasksCtrl.getTasks)` |
| 63 | GET | `/tasks/my-tasks` | authorize(ALL_HK_ROLES) | - | `router.get('/tasks/my-tasks', authorize(ALL_HK_ROLES), tasksCtrl.getMyTasks)` |
| 64 | GET | `/tasks/:id` | authorize(ALL_HK_ROLES) | - | `router.get('/tasks/:id', authorize(ALL_HK_ROLES), tasksCtrl.getTask)` |
| 65 | POST | `/tasks` | authorize(SUPERVISOR_ROLES) | - | `router.post('/tasks', authorize(SUPERVISOR_ROLES), tasksCtrl.createTask)` |
| 66 | PUT | `/tasks/:id/status` | authorize(ALL_HK_ROLES) | - | `router.put('/tasks/:id/status', authorize(ALL_HK_ROLES), tasksCtrl.updateTaskStatus)` |
| 67 | PUT | `/tasks/:id/assign` | authorize(SUPERVISOR_ROLES) | - | `router.put('/tasks/:id/assign', authorize(SUPERVISOR_ROLES), tasksCtrl.assignTask)` |
| 68 | PUT | `/tasks/:id/checklist` | authorize(ALL_HK_ROLES) | - | `router.put('/tasks/:id/checklist', authorize(ALL_HK_ROLES), tasksCtrl.updateChecklist)` |
| 69 | POST | `/tasks/bulk-assign` | authorize(SUPERVISOR_ROLES) | - | `router.post('/tasks/bulk-assign', authorize(SUPERVISOR_ROLES), tasksCtrl.bulkAssignTasks)` |
| 70 | POST | `/tasks/auto-assign` | authorize(SUPERVISOR_ROLES) | - | `router.post('/tasks/auto-assign', authorize(SUPERVISOR_ROLES), tasksCtrl.autoAssignTasks)` |
| 71 | DELETE | `/tasks/:id` | authorize(MANAGER_ROLES) | - | `router.delete('/tasks/:id', authorize(MANAGER_ROLES), tasksCtrl.deleteTask)` |
| 76 | GET | `/rooms` | authorize(ALL_HK_ROLES) | - | `router.get('/rooms', authorize(ALL_HK_ROLES), roomsCtrl.getRooms)` |
| 77 | GET | `/rooms/by-floor` | authorize(ALL_HK_ROLES) | - | `router.get('/rooms/by-floor', authorize(ALL_HK_ROLES), roomsCtrl.getRoomsByFloor)` |
| 78 | GET | `/rooms/for-inspection` | authorize(SUPERVISOR_ROLES) | - | `router.get('/rooms/for-inspection', authorize(SUPERVISOR_ROLES), roomsCtrl.getRoomsForInspection)` |
| 79 | GET | `/rooms/:id` | authorize(ALL_HK_ROLES) | - | `router.get('/rooms/:id', authorize(ALL_HK_ROLES), roomsCtrl.getRoom)` |
| 80 | GET | `/rooms/:id/history` | authorize(SUPERVISOR_ROLES) | - | `router.get('/rooms/:id/history', authorize(SUPERVISOR_ROLES), roomsCtrl.getRoomHistory)` |
| 81 | PUT | `/rooms/:id/status` | authorize(ALL_HK_ROLES) | - | `router.put('/rooms/:id/status', authorize(ALL_HK_ROLES), roomsCtrl.updateRoomStatus)` |
| 82 | PUT | `/rooms/:id/dnd` | authorize(ALL_HK_ROLES) | - | `router.put('/rooms/:id/dnd', authorize(ALL_HK_ROLES), roomsCtrl.setDND)` |
| 83 | PUT | `/rooms/:id/assign` | authorize(SUPERVISOR_ROLES) | - | `router.put('/rooms/:id/assign', authorize(SUPERVISOR_ROLES), roomsCtrl.assignAttendant)` |
| 84 | PUT | `/rooms/bulk-status` | authorize(SUPERVISOR_ROLES) | - | `router.put('/rooms/bulk-status', authorize(SUPERVISOR_ROLES), roomsCtrl.bulkUpdateRoomStatus)` |
| 89 | GET | `/inspections` | authorize(SUPERVISOR_ROLES) | - | `router.get('/inspections', authorize(SUPERVISOR_ROLES), inspectionsCtrl.getInspections)` |
| 90 | GET | `/inspections/queue` | authorize(SUPERVISOR_ROLES) | - | `router.get('/inspections/queue', authorize(SUPERVISOR_ROLES), inspectionsCtrl.getInspectionQueue)` |
| 91 | GET | `/inspections/stats` | authorize(SUPERVISOR_ROLES) | - | `router.get('/inspections/stats', authorize(SUPERVISOR_ROLES), inspectionsCtrl.getInspectionStats)` |
| 92 | GET | `/inspections/:id` | authorize(SUPERVISOR_ROLES) | - | `router.get('/inspections/:id', authorize(SUPERVISOR_ROLES), inspectionsCtrl.getInspection)` |
| 93 | POST | `/inspections` | authorize(SUPERVISOR_ROLES) | - | `router.post('/inspections', authorize(SUPERVISOR_ROLES), inspectionsCtrl.submitInspection)` |
| 98 | GET | `/staff` | authorize(SUPERVISOR_ROLES) | - | `router.get('/staff', authorize(SUPERVISOR_ROLES), staffCtrl.getStaff)` |
| 99 | GET | `/staff/workload` | authorize(SUPERVISOR_ROLES) | - | `router.get('/staff/workload', authorize(SUPERVISOR_ROLES), staffCtrl.getStaffWorkload)` |
| 100 | GET | `/staff/:id` | authorize(ALL_HK_ROLES) | - | `router.get('/staff/:id', authorize(ALL_HK_ROLES), staffCtrl.getStaffMember)` |
| 101 | GET | `/staff/:id/performance` | authorize(ALL_HK_ROLES) | - | `router.get('/staff/:id/performance', authorize(ALL_HK_ROLES), staffCtrl.getStaffPerformance)` |
| 102 | POST | `/staff` | authorize(MANAGER_ROLES) | - | `router.post('/staff', authorize(MANAGER_ROLES), staffCtrl.createStaffProfile)` |
| 103 | PUT | `/staff/:id` | authorize(MANAGER_ROLES) | - | `router.put('/staff/:id', authorize(MANAGER_ROLES), staffCtrl.updateStaffProfile)` |
| 104 | PUT | `/staff/:id/availability` | authorize(ALL_HK_ROLES) | - | `router.put('/staff/:id/availability', authorize(ALL_HK_ROLES), staffCtrl.updateAvailability)` |
| 105 | POST | `/staff/:id/check-in` | authorize(ALL_HK_ROLES) | - | `router.post('/staff/:id/check-in', authorize(ALL_HK_ROLES), staffCtrl.checkIn)` |
| 106 | POST | `/staff/:id/check-out` | authorize(ALL_HK_ROLES) | - | `router.post('/staff/:id/check-out', authorize(ALL_HK_ROLES), staffCtrl.checkOut)` |
| 111 | GET | `/linen/types` | authorize(ALL_HK_ROLES) | - | `router.get('/linen/types', authorize(ALL_HK_ROLES), linenCtrl.getLinenTypes)` |
| 112 | GET | `/linen/inventory` | authorize(ALL_HK_ROLES) | - | `router.get('/linen/inventory', authorize(ALL_HK_ROLES), linenCtrl.getLinenInventory)` |
| 113 | GET | `/linen/transactions` | authorize(SUPERVISOR_ROLES) | - | `router.get('/linen/transactions', authorize(SUPERVISOR_ROLES), linenCtrl.getTransactions)` |
| 114 | GET | `/linen/par-levels` | authorize(SUPERVISOR_ROLES) | - | `router.get('/linen/par-levels', authorize(SUPERVISOR_ROLES), linenCtrl.getParLevelStatus)` |
| 115 | POST | `/linen/transactions` | authorize(ALL_HK_ROLES) | - | `router.post('/linen/transactions', authorize(ALL_HK_ROLES), linenCtrl.recordTransaction)` |
| 116 | POST | `/linen/issue` | authorize(SUPERVISOR_ROLES) | - | `router.post('/linen/issue', authorize(SUPERVISOR_ROLES), linenCtrl.issueLinen)` |
| 117 | POST | `/linen/return` | authorize(ALL_HK_ROLES) | - | `router.post('/linen/return', authorize(ALL_HK_ROLES), linenCtrl.returnLinen)` |
| 122 | GET | `/lost-found` | authorize(ALL_HK_ROLES) | - | `router.get('/lost-found', authorize(ALL_HK_ROLES), lostFoundCtrl.getLostFoundItems)` |
| 123 | GET | `/lost-found/expiring` | authorize(SUPERVISOR_ROLES) | - | `router.get('/lost-found/expiring', authorize(SUPERVISOR_ROLES), lostFoundCtrl.getExpiringItems)` |
| 124 | GET | `/lost-found/stats` | authorize(SUPERVISOR_ROLES) | - | `router.get('/lost-found/stats', authorize(SUPERVISOR_ROLES), lostFoundCtrl.getLostFoundStats)` |
| 125 | GET | `/lost-found/:id` | authorize(ALL_HK_ROLES) | - | `router.get('/lost-found/:id', authorize(ALL_HK_ROLES), lostFoundCtrl.getLostFoundItem)` |
| 126 | POST | `/lost-found` | authorize(ALL_HK_ROLES) | - | `router.post('/lost-found', authorize(ALL_HK_ROLES), lostFoundCtrl.createLostFoundItem)` |
| 127 | PUT | `/lost-found/:id` | authorize(SUPERVISOR_ROLES) | - | `router.put('/lost-found/:id', authorize(SUPERVISOR_ROLES), lostFoundCtrl.updateLostFoundItem)` |
| 128 | PUT | `/lost-found/:id/status` | authorize(SUPERVISOR_ROLES) | - | `router.put('/lost-found/:id/status', authorize(SUPERVISOR_ROLES), lostFoundCtrl.updateItemStatus)` |
| 129 | POST | `/lost-found/:id/contact` | authorize(SUPERVISOR_ROLES) | - | `router.post('/lost-found/:id/contact', authorize(SUPERVISOR_ROLES), lostFoundCtrl.addContactAttempt)` |
| 134 | GET | `/maintenance` | authorize(ALL_HK_ROLES) | - | `router.get('/maintenance', authorize(ALL_HK_ROLES), maintenanceCtrl.getMaintenanceRequests)` |
| 135 | GET | `/maintenance/stats` | authorize(SUPERVISOR_ROLES) | - | `router.get('/maintenance/stats', authorize(SUPERVISOR_ROLES), maintenanceCtrl.getMaintenanceStats)` |
| 136 | GET | `/maintenance/room/:roomId` | authorize(ALL_HK_ROLES) | - | `router.get('/maintenance/room/:roomId', authorize(ALL_HK_ROLES), maintenanceCtrl.getRoomMaintenance)` |
| 137 | GET | `/maintenance/:id` | authorize(ALL_HK_ROLES) | - | `router.get('/maintenance/:id', authorize(ALL_HK_ROLES), maintenanceCtrl.getMaintenanceRequest)` |
| 138 | POST | `/maintenance` | authorize(ALL_HK_ROLES) | - | `router.post('/maintenance', authorize(ALL_HK_ROLES), maintenanceCtrl.createMaintenanceRequest)` |
| 139 | PUT | `/maintenance/:id/status` | authorize(SUPERVISOR_ROLES) | - | `router.put('/maintenance/:id/status', authorize(SUPERVISOR_ROLES), maintenanceCtrl.updateRequestStatus)` |
| 140 | PUT | `/maintenance/:id/verify` | authorize(SUPERVISOR_ROLES) | - | `router.put('/maintenance/:id/verify', authorize(SUPERVISOR_ROLES), maintenanceCtrl.verifyCompletion)` |
| 145 | GET | `/guest-requests` | authorize(ALL_HK_ROLES) | - | `router.get('/guest-requests', authorize(ALL_HK_ROLES), guestRequestsCtrl.getGuestRequests)` |
| 146 | GET | `/guest-requests/types-summary` | authorize(SUPERVISOR_ROLES) | - | `router.get('/guest-requests/types-summary', authorize(SUPERVISOR_ROLES), guestRequestsCtrl.getRequestTypesSummary)` |
| 147 | GET | `/guest-requests/room/:roomId` | authorize(ALL_HK_ROLES) | - | `router.get('/guest-requests/room/:roomId', authorize(ALL_HK_ROLES), guestRequestsCtrl.getRoomRequests)` |
| 148 | GET | `/guest-requests/:id` | authorize(ALL_HK_ROLES) | - | `router.get('/guest-requests/:id', authorize(ALL_HK_ROLES), guestRequestsCtrl.getGuestRequest)` |
| 149 | POST | `/guest-requests` | authorize(ALL_HK_ROLES) | - | `router.post('/guest-requests', authorize(ALL_HK_ROLES), guestRequestsCtrl.createGuestRequest)` |
| 150 | PUT | `/guest-requests/:id/assign` | authorize(SUPERVISOR_ROLES) | - | `router.put('/guest-requests/:id/assign', authorize(SUPERVISOR_ROLES), guestRequestsCtrl.assignGuestRequest)` |
| 151 | PUT | `/guest-requests/:id/complete` | authorize(ALL_HK_ROLES) | - | `router.put('/guest-requests/:id/complete', authorize(ALL_HK_ROLES), guestRequestsCtrl.completeGuestRequest)` |
| 152 | PUT | `/guest-requests/:id/feedback` | authorize(ALL_HK_ROLES) | - | `router.put('/guest-requests/:id/feedback', authorize(ALL_HK_ROLES), guestRequestsCtrl.recordFeedback)` |
| 157 | GET | `/scheduling/shifts` | authorize(ALL_HK_ROLES) | - | `router.get('/scheduling/shifts', authorize(ALL_HK_ROLES), schedulingCtrl.getShiftDefinitions)` |
| 158 | GET | `/scheduling/schedules` | authorize(SUPERVISOR_ROLES) | - | `router.get('/scheduling/schedules', authorize(SUPERVISOR_ROLES), schedulingCtrl.getSchedules)` |
| 159 | GET | `/scheduling/today-roster` | authorize(SUPERVISOR_ROLES) | - | `router.get('/scheduling/today-roster', authorize(SUPERVISOR_ROLES), schedulingCtrl.getTodayRoster)` |
| 160 | GET | `/scheduling/leave-requests` | authorize(SUPERVISOR_ROLES) | - | `router.get('/scheduling/leave-requests', authorize(SUPERVISOR_ROLES), schedulingCtrl.getLeaveRequests)` |
| 161 | GET | `/scheduling/shift-swaps` | authorize(SUPERVISOR_ROLES) | - | `router.get('/scheduling/shift-swaps', authorize(SUPERVISOR_ROLES), schedulingCtrl.getShiftSwaps)` |
| 162 | POST | `/scheduling/schedules` | authorize(MANAGER_ROLES) | - | `router.post('/scheduling/schedules', authorize(MANAGER_ROLES), schedulingCtrl.createSchedule)` |
| 163 | POST | `/scheduling/schedules/bulk` | authorize(MANAGER_ROLES) | - | `router.post('/scheduling/schedules/bulk', authorize(MANAGER_ROLES), schedulingCtrl.bulkCreateSchedules)` |
| 164 | PUT | `/scheduling/schedules/:id` | authorize(MANAGER_ROLES) | - | `router.put('/scheduling/schedules/:id', authorize(MANAGER_ROLES), schedulingCtrl.updateSchedule)` |
| 165 | DELETE | `/scheduling/schedules/:id` | authorize(MANAGER_ROLES) | - | `router.delete('/scheduling/schedules/:id', authorize(MANAGER_ROLES), schedulingCtrl.deleteSchedule)` |
| 166 | POST | `/scheduling/leave-requests` | authorize(ALL_HK_ROLES) | - | `router.post('/scheduling/leave-requests', authorize(ALL_HK_ROLES), schedulingCtrl.createLeaveRequest)` |
| 167 | PUT | `/scheduling/leave-requests/:id/review` | authorize(MANAGER_ROLES) | - | `router.put('/scheduling/leave-requests/:id/review', authorize(MANAGER_ROLES), schedulingCtrl.reviewLeaveRequest)` |
| 168 | POST | `/scheduling/shift-swaps` | authorize(ALL_HK_ROLES) | - | `router.post('/scheduling/shift-swaps', authorize(ALL_HK_ROLES), schedulingCtrl.createShiftSwap)` |
| 169 | PUT | `/scheduling/shift-swaps/:id/respond` | authorize(ALL_HK_ROLES) | - | `router.put('/scheduling/shift-swaps/:id/respond', authorize(ALL_HK_ROLES), schedulingCtrl.respondToShiftSwap)` |
| 170 | PUT | `/scheduling/shift-swaps/:id/approve` | authorize(MANAGER_ROLES) | - | `router.put('/scheduling/shift-swaps/:id/approve', authorize(MANAGER_ROLES), schedulingCtrl.approveShiftSwap)` |
| 175 | GET | `/reports/daily` | authorize(SUPERVISOR_ROLES) | - | `router.get('/reports/daily', authorize(SUPERVISOR_ROLES), reportsCtrl.getDailyReport)` |
| 176 | GET | `/reports/staff-performance` | authorize(SUPERVISOR_ROLES) | - | `router.get('/reports/staff-performance', authorize(SUPERVISOR_ROLES), reportsCtrl.getStaffPerformanceReport)` |
| 177 | GET | `/reports/productivity` | authorize(MANAGER_ROLES) | - | `router.get('/reports/productivity', authorize(MANAGER_ROLES), reportsCtrl.getProductivityReport)` |
| 178 | GET | `/reports/turnaround` | authorize(MANAGER_ROLES) | - | `router.get('/reports/turnaround', authorize(MANAGER_ROLES), reportsCtrl.getTurnaroundReport)` |
| 179 | GET | `/reports/supply-usage` | authorize(MANAGER_ROLES) | - | `router.get('/reports/supply-usage', authorize(MANAGER_ROLES), reportsCtrl.getSupplyUsageReport)` |
| 180 | GET | `/reports/export` | authorize(MANAGER_ROLES) | - | `router.get('/reports/export', authorize(MANAGER_ROLES), reportsCtrl.exportReport)` |
| 185 | POST | `/smart-assign/task/:taskId` | authorize(SUPERVISOR_ROLES) | - | `router.post('/smart-assign/task/:taskId', authorize(SUPERVISOR_ROLES), enhancedCtrl.autoAssignTask)` |
| 186 | POST | `/smart-assign/batch` | authorize(SUPERVISOR_ROLES) | - | `router.post('/smart-assign/batch', authorize(SUPERVISOR_ROLES), enhancedCtrl.autoAssignBatch)` |
| 187 | GET | `/smart-assign/recommendations/:taskId` | authorize(SUPERVISOR_ROLES) | - | `router.get('/smart-assign/recommendations/:taskId', authorize(SUPERVISOR_ROLES), enhancedCtrl.getAssignmentRecommendations)` |
| 192 | GET | `/gamification/leaderboard` | authorize(ALL_HK_ROLES) | - | `router.get('/gamification/leaderboard', authorize(ALL_HK_ROLES), enhancedCtrl.getLeaderboard)` |
| 193 | GET | `/gamification/staff/:staffId/stats` | authorize(ALL_HK_ROLES) | - | `router.get('/gamification/staff/:staffId/stats', authorize(ALL_HK_ROLES), enhancedCtrl.getStaffStats)` |
| 194 | GET | `/gamification/achievements` | authorize(ALL_HK_ROLES) | - | `router.get('/gamification/achievements', authorize(ALL_HK_ROLES), enhancedCtrl.getAchievements)` |
| 195 | GET | `/gamification/staff/:staffId/achievements` | authorize(ALL_HK_ROLES) | - | `router.get('/gamification/staff/:staffId/achievements', authorize(ALL_HK_ROLES), enhancedCtrl.getStaffAchievements)` |
| 196 | GET | `/gamification/challenges` | authorize(ALL_HK_ROLES) | - | `router.get('/gamification/challenges', authorize(ALL_HK_ROLES), enhancedCtrl.getTeamChallenges)` |
| 197 | POST | `/gamification/award-bonus` | authorize(SUPERVISOR_ROLES) | - | `router.post('/gamification/award-bonus', authorize(SUPERVISOR_ROLES), enhancedCtrl.awardBonusPoints)` |
| 202 | POST | `/guest-portal/request` | - | - | `router.post('/guest-portal/request', enhancedCtrl.submitGuestRequest)` |
| 203 | GET | `/guest-portal/request/:requestId/status` | - | - | `router.get('/guest-portal/request/:requestId/status', enhancedCtrl.getGuestRequestStatus)` |
| 204 | POST | `/guest-portal/clean-now` | - | - | `router.post('/guest-portal/clean-now', enhancedCtrl.requestCleanNow)` |
| 205 | POST | `/guest-portal/dnd-schedule` | - | - | `router.post('/guest-portal/dnd-schedule', enhancedCtrl.setDndSchedule)` |
| 206 | POST | `/guest-portal/preferences` | - | - | `router.post('/guest-portal/preferences', enhancedCtrl.saveGuestPreferences)` |
| 207 | GET | `/guest-portal/preferences/:roomNumber` | - | - | `router.get('/guest-portal/preferences/:roomNumber', enhancedCtrl.getGuestPreferences)` |
| 208 | POST | `/guest-portal/feedback/:requestId` | - | - | `router.post('/guest-portal/feedback/:requestId', enhancedCtrl.submitGuestFeedback)` |
| 213 | POST | `/sustainability/task/:taskId/metrics` | authorize(ALL_HK_ROLES) | - | `router.post('/sustainability/task/:taskId/metrics', authorize(ALL_HK_ROLES), enhancedCtrl.recordSustainabilityMetrics)` |
| 214 | GET | `/sustainability/daily-summary` | authorize(SUPERVISOR_ROLES) | - | `router.get('/sustainability/daily-summary', authorize(SUPERVISOR_ROLES), enhancedCtrl.getSustainabilityDailySummary)` |
| 215 | GET | `/sustainability/trends` | authorize(SUPERVISOR_ROLES) | - | `router.get('/sustainability/trends', authorize(SUPERVISOR_ROLES), enhancedCtrl.getSustainabilityTrends)` |
| 216 | POST | `/sustainability/green-guest` | authorize(ALL_HK_ROLES) | - | `router.post('/sustainability/green-guest', authorize(ALL_HK_ROLES), enhancedCtrl.registerGreenGuest)` |
| 217 | GET | `/sustainability/green-guest/:bookingId/stats` | authorize(ALL_HK_ROLES) | - | `router.get('/sustainability/green-guest/:bookingId/stats', authorize(ALL_HK_ROLES), enhancedCtrl.getGreenGuestStats)` |
| 218 | GET | `/sustainability/green-guest/:bookingId/certificate` | - | - | `router.get('/sustainability/green-guest/:bookingId/certificate', enhancedCtrl.generateGreenCertificate)` |
| 219 | GET | `/sustainability/staff-ranking` | authorize(SUPERVISOR_ROLES) | - | `router.get('/sustainability/staff-ranking', authorize(SUPERVISOR_ROLES), enhancedCtrl.getStaffSustainabilityRanking)` |
| 224 | GET | `/analytics/demand-forecast` | authorize(SUPERVISOR_ROLES) | - | `router.get('/analytics/demand-forecast', authorize(SUPERVISOR_ROLES), enhancedCtrl.getDemandForecast)` |
| 225 | GET | `/analytics/staff-prediction` | authorize(SUPERVISOR_ROLES) | - | `router.get('/analytics/staff-prediction', authorize(SUPERVISOR_ROLES), enhancedCtrl.getStaffPrediction)` |
| 226 | GET | `/analytics/quality-alerts` | authorize(SUPERVISOR_ROLES) | - | `router.get('/analytics/quality-alerts', authorize(SUPERVISOR_ROLES), enhancedCtrl.getQualityAlerts)` |
| 227 | GET | `/analytics/forecast-accuracy` | authorize(MANAGER_ROLES) | - | `router.get('/analytics/forecast-accuracy', authorize(MANAGER_ROLES), enhancedCtrl.getForecastAccuracy)` |
| 228 | GET | `/analytics/supply-prediction/:supplyId` | authorize(SUPERVISOR_ROLES) | - | `router.get('/analytics/supply-prediction/:supplyId', authorize(SUPERVISOR_ROLES), enhancedCtrl.getSupplyPrediction)` |
| 233 | POST | `/pms/booking-event` | authorize(SUPERVISOR_ROLES) | - | `router.post('/pms/booking-event', authorize(SUPERVISOR_ROLES), enhancedCtrl.processBookingEvent)` |
| 234 | POST | `/pms/sync-preferences` | authorize(ALL_HK_ROLES) | - | `router.post('/pms/sync-preferences', authorize(ALL_HK_ROLES), enhancedCtrl.syncGuestPreferences)` |
| 235 | GET | `/pms/today-arrivals` | authorize(ALL_HK_ROLES) | - | `router.get('/pms/today-arrivals', authorize(ALL_HK_ROLES), enhancedCtrl.getTodayArrivals)` |
| 236 | GET | `/pms/today-departures` | authorize(ALL_HK_ROLES) | - | `router.get('/pms/today-departures', authorize(ALL_HK_ROLES), enhancedCtrl.getTodayDepartures)` |
| 237 | POST | `/pms/auto-generate-tasks` | authorize(SUPERVISOR_ROLES) | - | `router.post('/pms/auto-generate-tasks', authorize(SUPERVISOR_ROLES), enhancedCtrl.autoGenerateTasks)` |
| 238 | POST | `/pms/notify-room-ready` | authorize(ALL_HK_ROLES) | - | `router.post('/pms/notify-room-ready', authorize(ALL_HK_ROLES), enhancedCtrl.notifyRoomReady)` |

## backend/src/routes/hr-reports.routes.ts

Imports: ../controllers/hrReports.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 8 | USE | `(middleware)` | authenticate | - | `router.use(authenticate)` |
| 9 | USE | `(middleware)` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]) | - | `router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]))` |
| 11 | GET | `/kra-p10` | - | - | `router.get('/kra-p10', generateKRAP10)` |
| 12 | GET | `/nssf` | - | - | `router.get('/nssf', generateNSSFReport)` |
| 13 | GET | `/shif` | - | - | `router.get('/shif', generateSHIFReport)` |
| 14 | GET | `/housing-levy` | - | - | `router.get('/housing-levy', generateHousingLevyReport)` |

## backend/src/routes/index.ts

Imports: ../controllers/email-booking.controller<br>../controllers/payment.controller<br>../middleware/auth.middleware<br>./accounting.routes<br>./additional-services.routes<br>./admin-ai.route<br>./admin-logs.routes<br>./admin.routes<br>./attendance.routes<br>./audit.routes<br>./auditor-reports.routes<br>./auditor-void-bills.routes<br>./auditor.routes<br>./auth.routes<br>./automation.routes<br>./banking.routes<br>./bar-stock-requests.routes<br>./bar.routes<br>./barcode.routes<br>./booking.routes<br>./branch-analytics.routes<br>./branch-operations.routes<br>./branchFoodControlConfig.routes<br>./buffet.routes<br>./cashier-clearance.routes<br>./cashier.routes<br>./catering-bookings.routes<br>./catering.routes<br>./channelManager.routes<br>./communication.routes<br>./communications.routes<br>./conference.routes<br>./credit.routes<br>./dispatch.routes<br>./document.routes<br>./email.routes<br>./employee-portal.routes<br>./facilities.routes<br>./finance.routes<br>./fleet.routes<br>./folio.routes<br>./foodControl.routes<br>./guest-portal.routes<br>./guest.routes<br>./housekeeping.routes<br>./hr-reports.routes<br>./inventory.routes<br>./kitchen-ledger.routes<br>./kitchen.routes<br>./kyogong.routes<br>./landing-email.routes<br>./maintenance.enhanced.routes<br>./maintenance.routes<br>./ml-forecasting.routes<br>./notification.routes<br>./payment.routes<br>./payments.routes<br>./payroll-adjustments.routes<br>./payroll-enhanced.routes<br>./payroll-policies.routes<br>./payroll-simple.routes<br>./payroll.routes<br>./performance.routes<br>./petty-cash.routes<br>./pricing.routes<br>./procurement.routes<br>./profit-loss.routes<br>./ratePlan.routes<br>./receipts.routes<br>./report.routes<br>./restaurant.reservation.routes<br>./restaurant.routes<br>./restaurant.table.routes<br>./revenue-oversight.routes<br>./room.routes<br>./search.routes<br>./security.routes<br>./shiftPnL.routes<br>./shifts.routes<br>./staff-audit.routes<br>./staff-performance.routes<br>./staff.routes<br>./statutory-deductions.routes<br>./stock-analytics.routes<br>./stock-take.routes<br>./storekeeping<br>./storekeeping.routes<br>./suppliers.routes<br>./system.routes<br>./user.routes<br>./vendor-performance.routes<br>./verify.routes<br>./waiter-sales.routes<br>./wastage.routes<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 99 | GET | `/health` | - | - | `router.get('/health', (req, res) => { res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV, uptime: process.uptime(), env_check: { SUPABASE_PROJECT_URL: !!process.env.SUPABASE_PROJECT_URL, SUPABASE_URL: !!` |
| 117 | USE | `/verify` | - | - | `router.use('/verify', verifyRoutes)` |
| 120 | USE | `/staff/performance` | - | - | `router.use('/staff/performance', staffPerformanceRoutes)` |
| 121 | USE | `/staff/simple-payroll` | - | - | `router.use('/staff/simple-payroll', payrollSimpleRoutes)` |
| 122 | USE | `/staff` | - | - | `router.use('/staff', staffAuditRoutes)` |
| 123 | USE | `/staff` | - | - | `router.use('/staff', staffRoutes)` |
| 124 | USE | `/auth` | - | - | `router.use('/auth', authRoutes)` |
| 125 | USE | `/users` | - | - | `router.use('/users', userRoutes)` |
| 126 | USE | `/bookings` | - | - | `router.use('/bookings', bookingRoutes)` |
| 127 | USE | `/rate-plans` | - | - | `router.use('/rate-plans', ratePlanRoutes)` |
| 128 | USE | `/pricing` | - | - | `router.use('/pricing', pricingRoutes)` |
| 129 | USE | `/documents` | - | - | `router.use('/documents', documentRoutes)` |
| 130 | USE | `/rooms` | - | - | `router.use('/rooms', roomRoutes)` |
| 131 | USE | `/guests` | - | - | `router.use('/guests', guestRoutes)` |
| 132 | USE | `/inventory` | - | - | `router.use('/inventory', inventoryRoutes)` |
| 133 | USE | `/housekeeping` | - | - | `router.use('/housekeeping', housekeepingRoutes)` |
| 134 | USE | `/maintenance` | - | - | `router.use('/maintenance', maintenanceRoutes)` |
| 135 | USE | `/reports` | - | - | `router.use('/reports', reportRoutes)` |
| 136 | USE | `/store` | - | - | `router.use('/store', storekeepingRoutes)` |
| 137 | USE | `/store` | - | - | `router.use('/store', stockAnalyticsRoutes)` |
| 138 | USE | `/finance` | - | - | `router.use('/finance', financeRoutes)` |
| 139 | USE | `/finance` | - | - | `router.use('/finance', revenueOversightRoutes)` |
| 140 | USE | `/finance` | - | - | `router.use('/finance', profitLossRoutes)` |
| 141 | USE | `/system` | - | - | `router.use('/system', systemRoutes)` |
| 142 | USE | `/fleet` | - | - | `router.use('/fleet', fleetRoutes)` |
| 143 | USE | `/bar` | - | - | `router.use('/bar', barRoutes)` |
| 144 | USE | `/restaurant` | - | - | `router.use('/restaurant', restaurantRoutes)` |
| 145 | USE | `/restaurant` | - | - | `router.use('/restaurant', waiterSalesRoutes)` |
| 146 | USE | `/restaurant/reservations` | - | - | `router.use('/restaurant/reservations', restaurantReservationRoutes)` |
| 147 | USE | `/restaurant/tables` | - | - | `router.use('/restaurant/tables', restaurantTableRoutes)` |
| 148 | USE | `/payments` | - | - | `router.use('/payments', paymentRoutes)` |
| 149 | USE | `/notifications` | - | - | `router.use('/notifications', notificationRoutes)` |
| 150 | USE | `/folios` | - | - | `router.use('/folios', folioRoutes)` |
| 151 | USE | `/audit` | - | - | `router.use('/audit', auditRoutes)` |
| 152 | USE | `/maintenance-enhanced` | - | - | `router.use('/maintenance-enhanced', maintenanceEnhancedRoutes)` |
| 153 | USE | `/auditor` | - | - | `router.use('/auditor', auditorRoutes)` |
| 154 | USE | `/auditor` | - | - | `router.use('/auditor', auditorVoidBillsRoutes)` |
| 155 | USE | `/accounting` | - | - | `router.use('/accounting', accountingRoutes)` |
| 156 | USE | `/receipts` | - | - | `router.use('/receipts', receiptsRoutes)` |
| 157 | USE | `/branch-operations` | - | - | `router.use('/branch-operations', branchOperationsRoutes)` |
| 158 | USE | `/automation` | - | - | `router.use('/automation', automationRoutes)` |
| 159 | USE | `/forecasting` | - | - | `router.use('/forecasting', mlForecastingRoutes)` |
| 160 | USE | `/vendors` | - | - | `router.use('/vendors', vendorPerformanceRoutes)` |
| 161 | USE | `/facilities` | - | - | `router.use('/facilities', facilitiesRoutes)` |
| 162 | USE | `/admin` | - | - | `router.use('/admin', adminRoutes)` |
| 163 | USE | `/communications` | - | - | `router.use('/communications', communicationsRoutes)` |
| 164 | USE | `/channel-manager` | - | - | `router.use('/channel-manager', channelManagerRoutes)` |
| 165 | USE | `/employee-portal` | - | - | `router.use('/employee-portal', employeePortalRoutes)` |
| 166 | USE | `/guest-portal` | - | - | `router.use('/guest-portal', guestPortalRoutes)` |
| 167 | USE | `/payroll` | - | - | `router.use('/payroll', payrollRoutes)` |
| 168 | USE | `/payroll/simple` | - | - | `router.use('/payroll/simple', payrollSimpleRoutes)` |
| 169 | USE | `/email` | - | - | `router.use('/email', emailRoutes)` |
| 170 | USE | `/landing-email` | - | - | `router.use('/landing-email', landingEmailRoutes)` |
| 171 | USE | `/barcode` | - | - | `router.use('/barcode', barcodeRoutes)` |
| 172 | USE | `/storekeeping` | - | - | `router.use('/storekeeping', storekeepingEnhancedRoutes)` |
| 173 | USE | `/cashier` | - | - | `router.use('/cashier', cashierRoutes)` |
| 174 | USE | `/cashier` | - | - | `router.use('/cashier', cashierClearanceRoutes)` |
| 175 | USE | `/wastage` | - | - | `router.use('/wastage', wastageRoutes)` |
| 176 | USE | `/kitchen-ledger` | - | - | `router.use('/kitchen-ledger', kitchenLedgerRoutes)` |
| 177 | USE | `/additional-services` | - | - | `router.use('/additional-services', additionalServicesRoutes)` |
| 178 | USE | `/reports/auditor` | - | - | `router.use('/reports/auditor', auditorReportsRoutes)` |
| 179 | USE | `/auditor-reports` | - | - | `router.use('/auditor-reports', auditorReportsRoutes)` |
| 180 | USE | `/conference` | - | - | `router.use('/conference', conferenceRoutes)` |
| 181 | USE | `/catering` | - | - | `router.use('/catering', cateringRoutes)` |
| 182 | USE | `/attendance` | - | - | `router.use('/attendance', attendanceRoutes)` |
| 183 | USE | `/petty-cash` | - | - | `router.use('/petty-cash', pettyCashRoutes)` |
| 184 | USE | `/credit` | - | - | `router.use('/credit', creditRoutes)` |
| 185 | USE | `/kitchen` | - | - | `router.use('/kitchen', kitchenRoutes)` |
| 186 | USE | `/procurement` | - | - | `router.use('/procurement', procurementRoutes)` |
| 187 | USE | `/hr-reports` | - | - | `router.use('/hr-reports', hrReportRoutes)` |
| 188 | USE | `/stock-takes` | - | - | `router.use('/stock-takes', stockTakeRoutes)` |
| 189 | USE | `/kyogong` | - | - | `router.use('/kyogong', kyogongRoutes)` |
| 190 | USE | `/banking` | - | - | `router.use('/banking', bankingRoutes)` |
| 191 | USE | `/suppliers` | - | - | `router.use('/suppliers', suppliersRoutes)` |
| 192 | USE | `/shifts` | - | - | `router.use('/shifts', shiftsRoutes)` |
| 193 | USE | `/payroll-enhanced` | - | - | `router.use('/payroll-enhanced', payrollEnhancedRoutes)` |
| 194 | USE | `/catering-bookings` | - | - | `router.use('/catering-bookings', cateringBookingsRoutes)` |
| 195 | USE | `/payroll-adjustments` | - | - | `router.use('/payroll-adjustments', payrollAdjustmentsRoutes)` |
| 196 | USE | `/payroll-statutory` | - | - | `router.use('/payroll-statutory', statutoryDeductionsRoutes)` |
| 197 | USE | `/performance` | - | - | `router.use('/performance', performanceRoutes)` |
| 198 | USE | `/payments-verification` | - | - | `router.use('/payments-verification', paymentsRoutes)` |
| 199 | USE | `/payroll-policies` | - | - | `router.use('/payroll-policies', payrollPoliciesRoutes)` |
| 200 | USE | `/admin-logs` | - | - | `router.use('/admin-logs', adminLogsRoutes)` |
| 201 | USE | `/admin-ai` | - | - | `router.use('/admin-ai', adminAiRoutes)` |
| 202 | USE | `/search` | - | - | `router.use('/search', searchRoutes)` |
| 203 | USE | `/analytics` | - | - | `router.use('/analytics', branchAnalyticsRoutes)` |
| 204 | USE | `/dispatch` | - | - | `router.use('/dispatch', dispatchRoutes)` |
| 205 | USE | `/security` | - | - | `router.use('/security', securityRoutes)` |
| 208 | USE | `/buffet` | - | - | `router.use('/buffet', buffetRoutes)` |
| 209 | USE | `/catering-food-control` | - | - | `router.use('/catering-food-control', cateringFoodControlRoutes)` |
| 210 | USE | `/food-control` | - | - | `router.use('/food-control', foodControlRoutes)` |
| 211 | USE | `/finance/shift-pnl` | - | - | `router.use('/finance/shift-pnl', shiftPnLRoutes)` |
| 212 | USE | `/branch-food-control-config` | - | - | `router.use('/branch-food-control-config', branchFoodControlConfigRoutes)` |
| 215 | POST | `/email/send-booking/:bookingId` | - | - | `router.post('/email/send-booking/:bookingId', sendBookingEmail)` |
| 216 | POST | `/email/send-all-bookings` | - | - | `router.post('/email/send-all-bookings', sendAllConfirmedBookingEmails)` |
| 217 | GET | `/email/test-connection` | - | - | `router.get('/email/test-connection', testEmailService)` |
| 222 | POST | `/mpesa/initiate` | protect | - | `router.post('/mpesa/initiate', protect, initiateMpesaPayment)` |
| 223 | POST | `/mpesa/callback` | - | - | `router.post('/mpesa/callback', mpesaCallback)` |

## backend/src/routes/inventory.routes.ts

Imports: ../controllers/inventory.controller<br>../middleware/auth<br>../models/User<br>../services/upload.service<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 33 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 36 | USE | `(middleware)` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE, UserRole.RESTAURANT, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANC) | - | `router.use(authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE, UserRole.RESTAURANT, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER ]))` |
| 55 | POST | `/items/:id/movement` | - | - | `router.post('/items/:id/movement', addStockMovement)` |
| 56 | GET | `/items/:id/movements` | - | - | `router.get('/items/:id/movements', getStockMovements)` |
| 58 | POST | `/items/:id/photos` | - | - | `router.post( '/items/:id/photos', uploadService.uploadMultiple('photos', 5), uploadItemPhotos )` |
| 74 | POST | `/purchase-orders/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post( '/purchase-orders/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), approvePurchaseOrder )` |
| 80 | POST | `/purchase-orders/:id/receive` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post( '/purchase-orders/:id/receive', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), receivePurchaseOrder )` |
| 97 | GET | `/low-stock` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]) | - | `router.get('/low-stock', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), getLowStockItems)` |
| 98 | GET | `/stats/overview` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]) | - | `router.get('/stats/overview', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), getInventoryStats)` |

## backend/src/routes/kitchen-ledger.routes.ts

Imports: ../controllers/kitchen-ledger.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 24 | USE | `(middleware)` | protect | - | `router.use(protect)` |

## backend/src/routes/kitchen.routes.ts

Imports: ../controllers/kitchen/expected-portions.controller<br>../controllers/kitchen/food-control.controller<br>../controllers/kitchen/recipes.controller<br>../controllers/kitchen/reports.controller<br>../controllers/kitchen/requisitions.controller<br>../controllers/kitchen/stock.controller<br>../controllers/kitchen/usage-wastage.controller<br>../controllers/kitchen/variance-reconciliation.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 81 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 113 | GET | `/stock` | authorize([...kitchenStaff, UserRole.AUDITOR]) | - | `router.get('/stock', authorize([...kitchenStaff, UserRole.AUDITOR]), getKitchenStock)` |
| 114 | GET | `/stock/ledger` | authorize([...kitchenStaff, UserRole.AUDITOR]) | - | `router.get('/stock/ledger', authorize([...kitchenStaff, UserRole.AUDITOR]), getKitchenLedger)` |
| 115 | GET | `/stock/:sku/history` | authorize([...kitchenStaff, UserRole.AUDITOR]) | - | `router.get('/stock/:sku/history', authorize([...kitchenStaff, UserRole.AUDITOR]), getItemHistory)` |
| 116 | GET | `/dashboard/stats` | authorize([...kitchenStaff, UserRole.AUDITOR]) | - | `router.get('/dashboard/stats', authorize([...kitchenStaff, UserRole.AUDITOR]), getKitchenDashboardStats)` |
| 119 | GET | `/portion-stock` | authorize([...kitchenStaff, UserRole.AUDITOR]) | - | `router.get('/portion-stock', authorize([...kitchenStaff, UserRole.AUDITOR]), getPortionStock)` |
| 120 | GET | `/portion-ledger` | authorize([...kitchenStaff, UserRole.AUDITOR]) | - | `router.get('/portion-ledger', authorize([...kitchenStaff, UserRole.AUDITOR]), getPortionLedger)` |
| 126 | POST | `/requisitions` | authorize(kitchenStaff) | - | `router.post('/requisitions', authorize(kitchenStaff), createRequisition)` |
| 127 | GET | `/requisitions` | authorize([...kitchenStaff, ...storekeepers]) | - | `router.get('/requisitions', authorize([...kitchenStaff, ...storekeepers]), getRequisitions)` |
| 128 | GET | `/requisitions/:id` | authorize([...kitchenStaff, ...storekeepers]) | - | `router.get('/requisitions/:id', authorize([...kitchenStaff, ...storekeepers]), getRequisition)` |
| 129 | PUT | `/requisitions/:id/approve` | authorize(kitchenManagers) | - | `router.put('/requisitions/:id/approve', authorize(kitchenManagers), approveRequisition)` |
| 130 | PUT | `/requisitions/:id/reject` | authorize(kitchenManagers) | - | `router.put('/requisitions/:id/reject', authorize(kitchenManagers), rejectRequisition)` |
| 131 | POST | `/requisitions/:id/fulfill` | authorize(storekeepers) | - | `router.post('/requisitions/:id/fulfill', authorize(storekeepers), fulfillRequisition)` |
| 137 | POST | `/recipes` | authorize(kitchenManagers) | - | `router.post('/recipes', authorize(kitchenManagers), createRecipe)` |
| 138 | GET | `/recipes` | authorize(kitchenStaff) | - | `router.get('/recipes', authorize(kitchenStaff), getRecipes)` |
| 139 | GET | `/recipes/:id` | authorize(kitchenStaff) | - | `router.get('/recipes/:id', authorize(kitchenStaff), getRecipe)` |
| 140 | PUT | `/recipes/:id` | authorize(kitchenManagers) | - | `router.put('/recipes/:id', authorize(kitchenManagers), updateRecipe)` |
| 141 | DELETE | `/recipes/:id` | authorize(kitchenManagers) | - | `router.delete('/recipes/:id', authorize(kitchenManagers), deleteRecipe)` |
| 142 | POST | `/recipes/:id/lock` | authorize(kitchenManagers) | - | `router.post('/recipes/:id/lock', authorize(kitchenManagers), lockRecipe)` |
| 143 | POST | `/recipes/:id/unlock` | authorize(kitchenManagers) | - | `router.post('/recipes/:id/unlock', authorize(kitchenManagers), unlockRecipe)` |
| 144 | GET | `/recipes/:id/history` | authorize([...kitchenStaff, UserRole.AUDITOR]) | - | `router.get('/recipes/:id/history', authorize([...kitchenStaff, UserRole.AUDITOR]), getRecipeHistory)` |
| 147 | POST | `/recipes/auto-deduct` | authorize([...kitchenStaff, UserRole.RECEPTIONIST]) | - | `router.post('/recipes/auto-deduct', authorize([...kitchenStaff, UserRole.RECEPTIONIST]), autoDeductIngredients)` |
| 153 | POST | `/usage` | authorize(kitchenStaff) | - | `router.post('/usage', authorize(kitchenStaff), recordUsage)` |
| 154 | GET | `/usage` | authorize([...kitchenStaff, ...kitchenManagers, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/usage', authorize([...kitchenStaff, ...kitchenManagers, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]), getUsageEntries)` |
| 155 | PUT | `/usage/:id/review` | authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN]) | - | `router.put('/usage/:id/review', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN]), reviewUsage)` |
| 156 | PUT | `/usage/:id/audit` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.put('/usage/:id/audit', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), auditUsage)` |
| 162 | POST | `/wastage` | authorize(kitchenStaff) | - | `router.post('/wastage', authorize(kitchenStaff), recordWastage)` |
| 163 | GET | `/wastage` | authorize([...kitchenStaff, ...kitchenManagers, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/wastage', authorize([...kitchenStaff, ...kitchenManagers, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]), getWastageRecords)` |
| 164 | PUT | `/wastage/:id` | authorize(kitchenStaff) | - | `router.put('/wastage/:id', authorize(kitchenStaff), updateWastage)` |
| 165 | DELETE | `/wastage/:id` | authorize(kitchenManagers) | - | `router.delete('/wastage/:id', authorize(kitchenManagers), deleteWastage)` |
| 166 | PUT | `/wastage/:id/review` | authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN]) | - | `router.put('/wastage/:id/review', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN]), reviewWastage)` |
| 167 | PUT | `/wastage/:id/audit` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.put('/wastage/:id/audit', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), auditWastage)` |
| 172 | GET | `/food-controls` | authorize(kitchenStaff) | - | `router.get('/food-controls', authorize(kitchenStaff), getFoodControls)` |
| 173 | POST | `/food-controls` | authorize(kitchenManagers) | - | `router.post('/food-controls', authorize(kitchenManagers), createFoodControl)` |
| 174 | PUT | `/food-controls/:id` | authorize(kitchenManagers) | - | `router.put('/food-controls/:id', authorize(kitchenManagers), updateFoodControl)` |
| 175 | DELETE | `/food-controls/:id` | authorize(kitchenManagers) | - | `router.delete('/food-controls/:id', authorize(kitchenManagers), deleteFoodControl)` |
| 176 | POST | `/food-controls/calculate` | authorize(kitchenStaff) | - | `router.post('/food-controls/calculate', authorize(kitchenStaff), calculateYield)` |
| 179 | GET | `/variance-reasons` | authorize(kitchenStaff) | - | `router.get('/variance-reasons', authorize(kitchenStaff), getVarianceReasons)` |
| 180 | GET | `/variance` | authorize(kitchenStaff) | - | `router.get('/variance', authorize(kitchenStaff), getDailyVariance)` |
| 181 | POST | `/variance/:id/reason` | authorize(kitchenStaff) | - | `router.post('/variance/:id/reason', authorize(kitchenStaff), submitVarianceReason)` |
| 182 | POST | `/variance/:id/approve` | authorize(kitchenManagers) | - | `router.post('/variance/:id/approve', authorize(kitchenManagers), approveVariance)` |
| 187 | GET | `/reports/yield` | authorize(kitchenManagers) | - | `router.get('/reports/yield', authorize(kitchenManagers), getYieldReport)` |
| 188 | GET | `/reports/loss` | authorize(kitchenManagers) | - | `router.get('/reports/loss', authorize(kitchenManagers), getLossReport)` |
| 189 | GET | `/reports/accountability` | authorize(kitchenManagers) | - | `router.get('/reports/accountability', authorize(kitchenManagers), getAccountabilityReport)` |
| 194 | GET | `/expected-portions` | authorize(kitchenStaff) | - | `router.get('/expected-portions', authorize(kitchenStaff), getExpectedPortions)` |
| 195 | GET | `/expected-portions/pending` | authorize(kitchenStaff) | - | `router.get('/expected-portions/pending', authorize(kitchenStaff), getPendingVerifications)` |
| 196 | GET | `/expected-portions/variance/summary` | authorize([...kitchenManagers, UserRole.AUDITOR]) | - | `router.get('/expected-portions/variance/summary', authorize([...kitchenManagers, UserRole.AUDITOR]), getVarianceSummary)` |
| 197 | GET | `/expected-portions/:id` | authorize(kitchenStaff) | - | `router.get('/expected-portions/:id', authorize(kitchenStaff), getExpectedPortion)` |
| 198 | PUT | `/expected-portions/:id/verify` | authorize(kitchenStaff) | - | `router.put('/expected-portions/:id/verify', authorize(kitchenStaff), verifyActualPortions)` |

## backend/src/routes/kyogong.routes.ts

Imports: ../controllers/kyogong/float-tracking.controller<br>../controllers/kyogong/petty-cash.controller<br>../controllers/kyogong/sales-points.controller<br>../controllers/kyogong/shifts.controller<br>../controllers/kyogong/spa-services.controller<br>../controllers/kyogong/transactions.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 58 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 66 | GET | `/sales-points` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNT) | - | `router.get('/sales-points', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER, UserRole.` |
| 84 | GET | `/sales-points/:id` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNT) | - | `router.get('/sales-points/:id', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER, UserR` |
| 107 | POST | `/shifts/open` | authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_B) | - | `router.post('/shifts/open', authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_BAR_CASHIER, UserRole.KYOGONG_RECEPTION_CASHIER ]), openShift )` |
| 121 | GET | `/shifts/current` | authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_B) | - | `router.get('/shifts/current', authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_BAR_CASHIER, UserRole.KYOGONG_RECEPTION_CASHIER ]), getCurren` |
| 135 | GET | `/shifts` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNT) | - | `router.get('/shifts', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGON` |
| 162 | GET | `/shifts/:shift_id/float` | authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER) | - | `router.get('/shifts/:shift_id/float', authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.K` |
| 180 | POST | `/shifts/:shift_id/float/adjust` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT ]) | - | `router.post('/shifts/:shift_id/float/adjust', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT ]), adjustFloat )` |
| 191 | GET | `/shifts/:shift_id/float/history` | authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER) | - | `router.get('/shifts/:shift_id/float/history', authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, Us` |
| 208 | GET | `/shifts/:shift_id/float/history/export` | authorize([ UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR ]) | - | `router.get('/shifts/:shift_id/float/history/export', authorize([ UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR ]), exportFloatHistory )` |
| 226 | GET | `/shifts/:id` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNT) | - | `router.get('/shifts/:id', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER, UserRole.KY` |
| 245 | PUT | `/shifts/:id/close` | authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_B) | - | `router.put('/shifts/:id/close', authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_BAR_CASHIER, UserRole.KYOGONG_RECEPTION_CASHIER ]), closeSh` |
| 259 | POST | `/shifts/:id/recalculate` | authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_B) | - | `router.post('/shifts/:id/recalculate', authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_BAR_CASHIER, UserRole.KYOGONG_RECEPTION_CASHIER ]), ` |
| 273 | PUT | `/shifts/:id/reconcile` | authorize([ UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT ]) | - | `router.put('/shifts/:id/reconcile', authorize([ UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT ]), reconcileShift )` |
| 283 | PUT | `/shifts/:id/approve` | authorize([ UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR ]) | - | `router.put('/shifts/:id/approve', authorize([ UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR ]), approveShift )` |
| 294 | PUT | `/shifts/:id/flag` | authorize([ UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT ]) | - | `router.put('/shifts/:id/flag', authorize([ UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT ]), flagShift )` |
| 308 | POST | `/shifts/:shift_id/transactions` | authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.RESTAURANT, UserRole.BARTENDER, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTI) | - | `router.post('/shifts/:shift_id/transactions', authorize([ UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.RESTAURANT, UserRole.BARTENDER, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_BAR_` |
| 324 | GET | `/shifts/:shift_id/transactions` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNT) | - | `router.get('/shifts/:shift_id/transactions', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_C` |
| 343 | GET | `/transactions/:id` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNT) | - | `router.get('/transactions/:id', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPA_CASHIER, UserR` |
| 362 | PUT | `/transactions/:id/void` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]) | - | `router.put('/transactions/:id/void', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]), voidTransaction )` |
| 376 | GET | `/spa-services/categories` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGO) | - | `router.get('/spa-services/categories', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_B` |
| 392 | GET | `/spa-services` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGO) | - | `router.get('/spa-services', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_BAR_CASHIER,` |
| 408 | POST | `/spa-services` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]) | - | `router.post('/spa-services', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]), createSpaService )` |
| 418 | PUT | `/spa-services/:id` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]) | - | `router.put('/spa-services/:id', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]), updateSpaService )` |
| 432 | GET | `/petty-cash/categories` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDI) | - | `router.get('/petty-cash/categories', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_RECEPTION_CASHIER ]), getPettyC` |
| 447 | GET | `/petty-cash/summary` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDI) | - | `router.get('/petty-cash/summary', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_RECEPTION_CASHIER ]), getPettyCash` |
| 462 | GET | `/petty-cash` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDI) | - | `router.get('/petty-cash', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_RECEPTION_CASHIER ]), getPettyCashEntries ` |
| 477 | POST | `/petty-cash` | authorize([ UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST, UserRole.KYOGONG_RECEPTION_CASHIER ]) | - | `router.post('/petty-cash', authorize([ UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST, UserRole.KYOGONG_RECEPTION_CASHIER ]), recordPettyCash )` |
| 491 | GET | `/dynamic-services` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGO) | - | `router.get('/dynamic-services', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.KYOGONG_SPA_CASHIER, UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.KYOGONG_SPORTS_BAR_CASH` |
| 507 | POST | `/dynamic-services` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]) | - | `router.post('/dynamic-services', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]), createDynamicService )` |
| 517 | PUT | `/dynamic-services/:id` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]) | - | `router.put('/dynamic-services/:id', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]), updateDynamicService )` |
| 531 | GET | `/pool-tokens` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, ) | - | `router.get('/pool-tokens', authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.KYOGONG_SPORTS_BAR_CASHIER ]), getPoolTokensInventory ` |

## backend/src/routes/landing-email.routes.ts

Imports: ../controllers/landing-email.controller<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 15 | POST | `/confirmation` | - | - | `router.post('/confirmation', sendLandingConfirmation)` |
| 16 | POST | `/reservation` | - | - | `router.post('/reservation', sendLandingReservation)` |
| 17 | POST | `/promotion` | - | - | `router.post('/promotion', sendLandingPromotion)` |
| 18 | POST | `/newsletter` | - | - | `router.post('/newsletter', sendLandingNewsletter)` |

## backend/src/routes/maintenance.enhanced.routes.ts

Imports: ../controllers/maintenance.enhanced.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 21 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 24 | GET | `/dashboard` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]) | - | `router.get('/dashboard', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]), getMaintenanceDashboard )` |
| 30 | GET | `/assets` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]) | - | `router.get('/assets', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]), getAssets )` |
| 35 | POST | `/assets` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/assets', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createAsset )` |
| 40 | PUT | `/assets/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/assets/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateAsset )` |
| 46 | GET | `/preventive` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]) | - | `router.get('/preventive', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]), getPreventiveSchedules )` |
| 51 | POST | `/preventive` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/preventive', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createPreventiveSchedule )` |
| 57 | GET | `/spare-parts` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]) | - | `router.get('/spare-parts', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]), getSpareParts )` |
| 62 | POST | `/spare-parts/transaction` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]) | - | `router.post('/spare-parts/transaction', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]), createPartTransaction )` |
| 68 | GET | `/contractors` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]) | - | `router.get('/contractors', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]), getContractors )` |
| 74 | POST | `/meter-reading` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]) | - | `router.post('/meter-reading', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]), recordMeterReading )` |
| 79 | GET | `/energy-consumption` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.get('/energy-consumption', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), getEnergyConsumption )` |
| 85 | POST | `/attachments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]) | - | `router.post('/attachments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]), uploadAttachment )` |

## backend/src/routes/maintenance.routes.ts

Imports: ../controllers/maintenance.controller<br>../middleware/auth<br>../models/User<br>../services/upload.service<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 35 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 38 | USE | `(middleware)` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.MAINTENANCE, UserRole.HOUSEKEEPING, UserRole.RECEPTIONIST, UserRole.FRONT_DE) | - | `router.use(authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.MAINTENANCE, UserRole.HOUSEKEEPING, UserRole.RECEPTIONIST, UserRole.FRONT_DESK_SUPERVISOR ]))` |
| 57 | POST | `/tasks/:id/assign` | - | - | `router.post('/tasks/:id/assign', assignTask)` |
| 58 | POST | `/tasks/:id/start` | - | - | `router.post('/tasks/:id/start', startTask)` |
| 59 | POST | `/tasks/:id/complete` | - | - | `router.post('/tasks/:id/complete', completeTask)` |
| 60 | POST | `/tasks/:id/verify` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/tasks/:id/verify', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), verifyTask)` |
| 74 | POST | `/tasks/:id/issues/:issueId/resolve` | - | - | `router.post('/tasks/:id/issues/:issueId/resolve', resolveIssue)` |
| 76 | POST | `/tasks/:id/photos` | - | - | `router.post( '/tasks/:id/photos', uploadService.uploadMultiple('photos', 5), uploadTaskPhotos )` |
| 82 | GET | `/tasks/:id/history` | - | - | `router.get('/tasks/:id/history', getTaskHistory)` |
| 94 | GET | `/assets/:id/history` | - | - | `router.get('/assets/:id/history', getAssetHistory)` |
| 97 | GET | `/schedule` | - | - | `router.get('/schedule', getSchedule)` |
| 98 | GET | `/stats/overview` | - | - | `router.get('/stats/overview', getStats)` |

## backend/src/routes/ml-forecasting.routes.ts

Imports: ../middleware/auth<br>../models/User<br>../services/ml-forecasting.service<br>../utils/logger<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 14 | GET | `/sales` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER ])<br>protect | - | `router.get( '/sales', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER ]), async (req, res) => { try { const { branch_id, days } = req.query; const forecast = await mlForecastingService.generateSalesForecast( branch` |
| 47 | GET | `/inventory` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ])<br>protect | - | `router.get( '/inventory', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ]), async (req, res) => { try { const { category, days } = req.query; const forecast = await mlForecastingService.generateInventoryDeman` |
| 80 | GET | `/occupancy` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ])<br>protect | - | `router.get( '/occupancy', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER ]), async (req, res) => { try { const { branch_id, days } = req.query; const forecast = await mlForecastingService.generateOccupancyForecast(` |
| 113 | GET | `/budget` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER ])<br>protect | - | `router.get( '/budget', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER ]), async (req, res) => { try { const { department_id, months } = req.query; const forecast = await mlForecastingService.generateBudgetForecast` |

## backend/src/routes/notification.routes.ts

Imports: ../middleware/auth<br>../services/notification.service<br>../utils/logger<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 13 | GET | `/` | authenticate | - | `router.get('/', authenticate, async (req: Request, res: Response) => { try { const userId = req.user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'User not authenticated' }); } const filters = { is_read: req.query.is_read === 'tru` |
| 47 | GET | `/unread-count` | authenticate | - | `router.get('/unread-count', authenticate, async (req: Request, res: Response) => { try { const userId = req.user?.id; if (!userId) { // Return 0 count instead of error to prevent frontend issues return res.json({ success: true, data: { count: 0 } }); } const c` |
| 79 | POST | `/` | authenticate | - | `router.post('/', authenticate, async (req: Request, res: Response) => { try { const userRole = req.user?.role; if (userRole !== 'super_admin' && userRole !== 'general_manager') { return res.status(403).json({ success: false, message: 'Unauthorized' }); } const` |
| 113 | POST | `/bulk` | authenticate | - | `router.post('/bulk', authenticate, async (req: Request, res: Response) => { try { const userRole = req.user?.role; if (userRole !== 'super_admin' && userRole !== 'general_manager') { return res.status(403).json({ success: false, message: 'Unauthorized' }); } c` |
| 148 | PATCH | `/:id/read` | authenticate | - | `router.patch('/:id/read', authenticate, async (req: Request, res: Response) => { try { const userId = req.user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'User not authenticated' }); } const notificationId = parseInt(req.params.` |
| 183 | PATCH | `/mark-all-read` | authenticate | - | `router.patch('/mark-all-read', authenticate, async (req: Request, res: Response) => { try { const userId = req.user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'User not authenticated' }); } const count = await notificationServic` |
| 211 | DELETE | `/clear-my-notifications` | authenticate | - | `router.delete('/clear-my-notifications', authenticate, async (req: Request, res: Response) => { try { const userId = req.user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'User not authenticated' }); } const deletedCount = await n` |
| 239 | DELETE | `/:id` | authenticate | - | `router.delete('/:id', authenticate, async (req: Request, res: Response) => { try { const userRole = req.user?.role; if (userRole !== 'super_admin' && userRole !== 'general_manager') { return res.status(403).json({ success: false, message: 'Unauthorized' }); } ` |
| 274 | POST | `/test-notification` | authenticate | - | `router.post('/test-notification', authenticate, async (req: Request, res: Response) => { try { const userId = req.user?.id; if (!userId) { return res.status(401).json({ success: false, message: 'User not authenticated' }); } const notification = await notifica` |
| 309 | POST | `/cleanup` | authenticate | - | `router.post('/cleanup', authenticate, async (req: Request, res: Response) => { try { const userRole = req.user?.role; if (userRole !== 'super_admin') { return res.status(403).json({ success: false, message: 'Unauthorized' }); } const expiredCount = await notif` |
| 342 | POST | `/notify-role` | authenticate | - | `router.post('/notify-role', authenticate, async (req: Request, res: Response) => { try { const userRole = req.user?.role; if (userRole !== 'super_admin' && userRole !== 'general_manager') { return res.status(403).json({ success: false, message: 'Unauthorized' ` |
| 385 | POST | `/notify-branch` | authenticate | - | `router.post('/notify-branch', authenticate, async (req: Request, res: Response) => { try { const userRole = req.user?.role; if (userRole !== 'super_admin' && userRole !== 'general_manager') { return res.status(403).json({ success: false, message: 'Unauthorized` |
| 428 | POST | `/notify-user` | authenticate | - | `router.post('/notify-user', authenticate, async (req: Request, res: Response) => { try { const userRole = req.user?.role; if (userRole !== 'super_admin' && userRole !== 'general_manager') { return res.status(403).json({ success: false, message: 'Unauthorized' ` |

## backend/src/routes/payment.routes.ts

Imports: ../config/supabase<br>../controllers/payment.controller<br>../middleware/auth<br>../utils/logger<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 29 | POST | `/mpesa/callback` | - | - | `router.post('/mpesa/callback', mpesaCallback)` |
| 32 | POST | `/mpesa/timeout` | - | - | `router.post('/mpesa/timeout', (req, res) => { res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' }); })` |
| 37 | POST | `/mpesa/result` | - | - | `router.post('/mpesa/result', (req, res) => { res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' }); })` |
| 42 | POST | `/paystack/webhook` | - | - | `router.post('/paystack/webhook', paystackWebhook)` |
| 45 | GET | `/paystack/callback` | - | upload | `router.get('/paystack/callback', async (req, res) => { try { const { reference, trxref } = req.query; const paymentReference = reference \|\| trxref; if (!paymentReference) { return res.redirect(`${process.env.FRONTEND_URL \|\| 'http://localhost:3001'}/booking?err` |
| 79 | POST | `/booking/initiate` | - | - | `router.post('/booking/initiate', initiateBookingPayment)` |
| 82 | POST | `/mpesa/initiate` | - | - | `router.post('/mpesa/initiate', initiateMpesaPayment)` |
| 85 | POST | `/paystack/initiate` | - | - | `router.post('/paystack/initiate', initiatePaystackPayment)` |
| 88 | GET | `/mpesa/status/:checkoutRequestId` | authenticate | - | `router.get('/mpesa/status/:checkoutRequestId', authenticate, checkMpesaStatus)` |
| 91 | GET | `/mpesa/search` | authenticate | - | `router.get('/mpesa/search', authenticate, searchMpesaHistory)` |
| 98 | GET | `/paystack/verify/:reference` | - | - | `router.get('/paystack/verify/:reference', verifyPaystackPayment)` |
| 101 | GET | `/status/:paymentId` | - | - | `router.get('/status/:paymentId', getPaymentStatus)` |
| 104 | POST | `/verify-strict` | - | - | `router.post('/verify-strict', verifyStrictPayment)` |
| 111 | POST | `/intent` | authenticate | - | `router.post('/intent', authenticate, createPaymentIntent)` |
| 114 | POST | `/confirm/:paymentIntentId` | authenticate | - | `router.post('/confirm/:paymentIntentId', authenticate, confirmPayment)` |
| 117 | POST | `/cancel/:paymentIntentId` | authenticate | - | `router.post('/cancel/:paymentIntentId', authenticate, cancelPayment)` |
| 120 | GET | `/folio/:folioId/history` | authenticate | - | `router.get('/folio/:folioId/history', authenticate, getFolioPayments)` |

## backend/src/routes/payments.routes.ts

Imports: ../controllers/payments.controller<br>../middleware/auth.middleware<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 9 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 12 | GET | `/` | - | - | `router.get('/', (req, res) => paymentsController.getPayments(req, res))` |
| 15 | GET | `/stats` | - | - | `router.get('/stats', (req, res) => paymentsController.getPaymentStats(req, res))` |
| 18 | GET | `/:id` | - | - | `router.get('/:id', (req, res) => paymentsController.getPaymentById(req, res))` |
| 21 | POST | `/` | - | - | `router.post('/', (req, res) => paymentsController.createPayment(req, res))` |
| 24 | PUT | `/:id/verify-accountant` | - | - | `router.put('/:id/verify-accountant', (req, res) => paymentsController.verifyByAccountant(req, res))` |
| 27 | PUT | `/:id/verify-auditor` | - | - | `router.put('/:id/verify-auditor', (req, res) => paymentsController.verifyByAuditor(req, res))` |

## backend/src/routes/payroll-adjustments.routes.ts

Imports: ../controllers/payroll-adjustments.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 16 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 19 | GET | `/` | authorize(adjustmentRoles) | - | `router.get('/', authorize(adjustmentRoles), adjustmentsController.getAdjustments)` |
| 22 | POST | `/` | authorize(adjustmentRoles) | - | `router.post('/', authorize(adjustmentRoles), adjustmentsController.createAdjustment)` |
| 23 | PATCH | `/:id/approve` | authorize(adjustmentRoles) | - | `router.patch('/:id/approve', authorize(adjustmentRoles), adjustmentsController.approveAdjustment)` |
| 24 | PATCH | `/:id/reject` | authorize(adjustmentRoles) | - | `router.patch('/:id/reject', authorize(adjustmentRoles), adjustmentsController.rejectAdjustment)` |
| 25 | PATCH | `/:id/void` | authorize(adjustmentRoles) | - | `router.patch('/:id/void', authorize(adjustmentRoles), adjustmentsController.voidAdjustment)` |
| 26 | POST | `/:id/void` | authorize(adjustmentRoles) | - | `router.post('/:id/void', authorize(adjustmentRoles), adjustmentsController.voidAdjustment)` |

## backend/src/routes/payroll-enhanced.routes.ts

Imports: ../controllers/payroll-enhanced.controller<br>../middleware/auth.middleware<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 17 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 20 | GET | `/deduction-rates` | authorize('hr_manager', 'super_admin', 'accountant') | - | `router.get('/deduction-rates', authorize('hr_manager', 'super_admin', 'accountant'), getDeductionRates)` |
| 21 | PUT | `/deduction-rates/:id` | authorize('hr_manager', 'super_admin') | - | `router.put('/deduction-rates/:id', authorize('hr_manager', 'super_admin'), updateDeductionRate)` |
| 24 | POST | `/calculate` | authorize('hr_manager', 'super_admin', 'accountant') | - | `router.post('/calculate', authorize('hr_manager', 'super_admin', 'accountant'), calculatePayroll)` |
| 27 | GET | `/` | authorize('hr_manager', 'super_admin', 'accountant') | - | `router.get('/', authorize('hr_manager', 'super_admin', 'accountant'), getEnhancedPayroll)` |
| 28 | POST | `/` | authorize('hr_manager', 'super_admin') | - | `router.post('/', authorize('hr_manager', 'super_admin'), processEnhancedPayroll)` |
| 29 | POST | `/bulk` | authorize('hr_manager', 'super_admin') | - | `router.post('/bulk', authorize('hr_manager', 'super_admin'), bulkProcessPayroll)` |
| 30 | PUT | `/:id` | authorize('hr_manager', 'super_admin') | - | `router.put('/:id', authorize('hr_manager', 'super_admin'), updateEnhancedPayroll)` |
| 33 | GET | `/:id/payslip` | authorize('hr_manager', 'super_admin', 'accountant') | - | `router.get('/:id/payslip', authorize('hr_manager', 'super_admin', 'accountant'), generatePayslip)` |

## backend/src/routes/payroll-policies.routes.ts

Imports: ../controllers/policy.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 7 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 8 | USE | `(middleware)` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]))` |

## backend/src/routes/payroll-simple.routes.ts

Imports: ../controllers/advances.controller<br>../controllers/credit-bills.controller<br>../controllers/loans.controller<br>../controllers/payroll-simple.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 36 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 42 | POST | `/credit-bills/migrate-pending` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/credit-bills/migrate-pending', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), triggerPendingBillsMigration)` |
| 43 | POST | `/credit-bills` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.RESTAURANT, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOU) | - | `router.post('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.RESTAURANT, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createCreditBill)` |
| 44 | GET | `/credit-bills` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, ) | - | `router.get('/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.HR_MANAGER]), getCreditBills)` |
| 45 | PATCH | `/credit-bills/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.patch('/credit-bills/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), updateCreditBillStatus)` |
| 46 | POST | `/credit-bills/:id/partial-payment` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/credit-bills/:id/partial-payment', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), partialPayCreditBill)` |
| 47 | GET | `/credit-bills/:id/payments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get('/credit-bills/:id/payments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getCreditBillPayments)` |
| 52 | POST | `/advances` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE]) | - | `router.post('/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE]), createAdvance)` |
| 53 | GET | `/advances` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, ) | - | `router.get('/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.HR_MANAGER]), getAdvances)` |
| 54 | PATCH | `/advances/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.patch('/advances/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), approveAdvance)` |
| 59 | POST | `/loans` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createLoan)` |
| 60 | GET | `/loans` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, ) | - | `router.get('/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.HR_MANAGER]), getLoans)` |
| 61 | PATCH | `/loans/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.patch('/loans/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), approveLoan)` |
| 66 | POST | `/generate` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR) | - | `router.post('/generate', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), generatePayroll)` |
| 67 | GET | `/history` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.EMPLOYE) | - | `router.get('/history', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.EMPLOYEE, UserRole.AUDITOR]), getPayrollRecords)` |
| 68 | GET | `/summary` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR) | - | `router.get('/summary', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), getPayrollSummary)` |
| 69 | POST | `/email-all` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR) | - | `router.post('/email-all', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), emailPayslips)` |
| 70 | POST | `/download-zip` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR) | - | `router.post('/download-zip', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]), downloadPayslipsZip)` |
| 75 | GET | `/pending-approvals` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/pending-approvals', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getPendingApprovals)` |
| 76 | POST | `/approve-batch` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.post('/approve-batch', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), approvePayrollBatch)` |
| 77 | POST | `/:type/:id/approve` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/:type/:id/approve', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), approvePayrollItem)` |
| 78 | POST | `/:type/:id/reject` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.post('/:type/:id/reject', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), rejectPayrollItem)` |

## backend/src/routes/payroll.routes.ts

Imports: ../controllers/advances.controller<br>../controllers/credit-bills.controller<br>../controllers/loans.controller<br>../controllers/payroll-simple.controller<br>../controllers/payroll.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 30 | USE | `(middleware)` | authenticate | - | `router.use(authenticate)` |
| 33 | GET | `/draft` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.get( '/draft', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), getDraftPayroll )` |
| 40 | POST | `/generate` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.post( '/generate', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), forceGeneratePayroll )` |
| 47 | GET | `/history` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.get( '/history', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), getPayrollHistory )` |
| 54 | GET | `/summary` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.get( '/summary', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), getPayrollSummary )` |
| 61 | POST | `/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.post( '/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), approvePayroll )` |
| 68 | POST | `/adjustments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.post( '/adjustments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), addAdjustment )` |
| 75 | GET | `/adjustments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.get( '/adjustments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), getAdjustments )` |
| 82 | GET | `/:id/payslip` | - | - | `router.get('/:id/payslip', generatePayslip)` |
| 85 | GET | `/run/:runId/payslips-zip` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.get( '/run/:runId/payslips-zip', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), downloadPayslipsZip )` |
| 92 | GET | `/run/:runId/summary-pdf` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.get( '/run/:runId/summary-pdf', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), downloadSummaryPDF )` |
| 100 | POST | `/credit-bills/migrate-pending` | authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post( '/credit-bills/migrate-pending', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), triggerPendingBillsMigration )` |
| 106 | POST | `/credit-bills` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.CASHIER, UserRole.AUDITOR]) | - | `router.post( '/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.CASHIER, UserRole.AUDITOR]), createCreditBill )` |
| 112 | GET | `/credit-bills` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get( '/credit-bills', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getCreditBills )` |
| 118 | PATCH | `/credit-bills/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.patch( '/credit-bills/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), updateCreditBillStatus )` |
| 124 | POST | `/credit-bills/:id/partial-payment` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post( '/credit-bills/:id/partial-payment', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), partialPayCreditBill )` |
| 130 | GET | `/credit-bills/:id/payments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.get( '/credit-bills/:id/payments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getCreditBillPayments )` |
| 137 | GET | `/loans` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.HR_MANAGER) | - | `router.get( '/loans', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.HR_MANAGER]), getLoans )` |
| 143 | POST | `/loans` | authorize([UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post( '/loans', authorize([UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createLoan )` |
| 149 | POST | `/loans/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.post( '/loans/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), approveLoan )` |
| 155 | POST | `/loans/:id/reject` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]) | - | `router.post( '/loans/:id/reject', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), rejectLoan )` |
| 162 | GET | `/advances` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.HR_MANAGER) | - | `router.get( '/advances', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.HR_MANAGER]), getAdvances )` |
| 168 | POST | `/advances` | authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post( '/advances', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), createAdvance )` |
| 174 | POST | `/advances/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.post( '/advances/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), approveAdvance )` |
| 180 | POST | `/advances/:id/reject` | authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.post( '/advances/:id/reject', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), rejectAdvance )` |
| 187 | POST | `/trigger-migration` | authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post( '/trigger-migration', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), triggerPendingBillsMigration )` |

## backend/src/routes/performance.routes.ts

Imports: ../controllers/performance.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 9 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 11 | GET | `/staff-metrics` | authorize([UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.get( '/staff-metrics', authorize([UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), performanceController.getStaffPerformance )` |

## backend/src/routes/petty-cash.routes.ts

Imports: ../controllers/petty-cash.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 12 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 14 | GET | `/` | - | - | `router.get('/', getPettyCashTransactions)` |
| 15 | POST | `/` | - | - | `router.post('/', requestPettyCash)` |
| 16 | PATCH | `/:id/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]) | - | `router.patch('/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), updatePettyCashStatus)` |

## backend/src/routes/pricing.routes.ts

Imports: ../controllers/pricing.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 7 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 9 | POST | `/quote` | - | - | `router.post('/quote', getPricingQuote)` |

## backend/src/routes/procurement.routes.ts

Imports: ../controllers/storekeeping/grn.controller<br>../controllers/storekeeping/purchase-orders.controller<br>../controllers/storekeeping/supplier-invoices.controller<br>../controllers/storekeeping/supplier-payments.controller<br>../controllers/storekeeping/supplier-reports.controller<br>../middleware/auth<br>../middleware/moduleAccess<br>../middleware/validation<br>../models/User<br>../schemas/purchaseOrder.schema<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 56 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 128 | PUT | `/purchase-orders/:id/approve` | authorize(procurementRoles) | - | `router.put('/purchase-orders/:id/approve', authorize(procurementRoles), validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]), enforceBranchScoping, validateParams(POIdSchema), approvePurchaseOrder )` |
| 136 | PUT | `/purchase-orders/:id/cancel` | authorize(procurementRoles) | - | `router.put('/purchase-orders/:id/cancel', authorize(procurementRoles), validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]), enforceBranchScoping, validateParams(POIdSchema), cancelPurchaseOrder )` |
| 144 | POST | `/purchase-orders/:id/send` | authorize(procurementRoles) | - | `router.post('/purchase-orders/:id/send', authorize(procurementRoles), validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]), enforceBranchScoping, validateParams(POIdSchema), sendPurchaseOrderToSupplier )` |
| 162 | PUT | `/grn/:id/approve` | authorize(auditorRoles) | - | `router.put('/grn/:id/approve', authorize(auditorRoles), approveGRN)` |
| 163 | PUT | `/grn/:id/cancel` | authorize(storeRoles) | - | `router.put('/grn/:id/cancel', authorize(storeRoles), cancelGRN)` |
| 175 | PUT | `/invoices/:id/submit` | authorize(procurementRoles) | - | `router.put('/invoices/:id/submit', authorize(procurementRoles), submitInvoice)` |
| 176 | PUT | `/invoices/:id/approve` | authorize(auditorRoles) | - | `router.put('/invoices/:id/approve', authorize(auditorRoles), approveInvoice)` |
| 177 | PUT | `/invoices/:id/reject` | authorize(auditorRoles) | - | `router.put('/invoices/:id/reject', authorize(auditorRoles), rejectInvoice)` |
| 189 | PUT | `/payments/:id/process` | authorize(auditorRoles) | - | `router.put('/payments/:id/process', authorize(auditorRoles), processPayment)` |
| 194 | GET | `/reports/aging` | authorize(allProcurementStaff) | - | `router.get('/reports/aging', authorize(allProcurementStaff), getAgingAnalysis)` |
| 195 | GET | `/reports/vat` | authorize(allProcurementStaff) | - | `router.get('/reports/vat', authorize(allProcurementStaff), getVATReport)` |
| 196 | GET | `/reports/grni` | authorize(allProcurementStaff) | - | `router.get('/reports/grni', authorize(allProcurementStaff), getGRNIReport)` |
| 197 | GET | `/reports/audit-trail` | authorize(allProcurementStaff) | - | `router.get('/reports/audit-trail', authorize(allProcurementStaff), getAuditTrail)` |
| 198 | GET | `/ledger/:supplierId` | authorize(allProcurementStaff) | - | `router.get('/ledger/:supplierId', authorize(allProcurementStaff), getSupplierLedger)` |
| 199 | GET | `/performance/:supplierId` | authorize(allProcurementStaff) | - | `router.get('/performance/:supplierId', authorize(allProcurementStaff), getSupplierPerformance)` |

## backend/src/routes/profit-loss.routes.ts

Imports: ../controllers/profit-loss.controller<br>../middleware/auth.middleware<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 11 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 12 | USE | `(middleware)` | authorize('branch_manager', 'auditor', 'super_admin', 'general_manager') | - | `router.use(authorize('branch_manager', 'auditor', 'super_admin', 'general_manager'))` |
| 15 | GET | `/profit-loss` | - | - | `router.get('/profit-loss', getProfitLossStatement)` |
| 18 | GET | `/expense-breakdown` | - | - | `router.get('/expense-breakdown', getExpenseBreakdown)` |

## backend/src/routes/ratePlan.routes.ts

Imports: ../controllers/ratePlan.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 15 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 17 | GET | `/` | - | - | `router.get('/', getRatePlans)` |
| 18 | GET | `/:id` | - | - | `router.get('/:id', getRatePlan)` |
| 21 | POST | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createRatePlan )` |
| 26 | PUT | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateRatePlan )` |
| 31 | DELETE | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.delete('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), deleteRatePlan )` |

## backend/src/routes/receipts.routes.ts

Imports: ../controllers/receipts.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 15 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 18 | GET | `/` | - | - | `router.get('/', getReceipts)` |
| 21 | GET | `/stats` | - | - | `router.get('/stats', getReceiptStats)` |
| 24 | GET | `/revenue` | - | - | `router.get('/revenue', getDailyRevenue)` |
| 27 | GET | `/:id` | - | - | `router.get('/:id', getReceiptById)` |
| 30 | POST | `/` | - | - | `router.post('/', createReceipt)` |
| 33 | PUT | `/:id` | - | - | `router.put('/:id', updateReceipt)` |

## backend/src/routes/report.routes.ts

Imports: ../controllers/report.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 34 | POST | `/export` | - | - | `router.post('/export', exportReport)` |
| 35 | POST | `/generate/async` | - | - | `router.post('/generate/async', generateAsyncReport)` |
| 36 | GET | `/jobs/:id/status` | - | - | `router.get('/jobs/:id/status', getReportJobStatus)` |
| 39 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 42 | USE | `(middleware)` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]))` |
| 45 | GET | `/dashboard` | - | - | `router.get('/dashboard', getDashboardReport)` |
| 46 | GET | `/revenue` | - | - | `router.get('/revenue', getRevenueReport)` |
| 47 | GET | `/occupancy` | - | - | `router.get('/occupancy', getOccupancyReport)` |
| 48 | GET | `/inventory` | - | - | `router.get('/inventory', getInventoryReport)` |
| 49 | GET | `/housekeeping` | - | - | `router.get('/housekeeping', getHousekeepingReport)` |
| 50 | GET | `/maintenance` | - | - | `router.get('/maintenance', getMaintenanceReport)` |
| 51 | GET | `/conference` | - | - | `router.get('/conference', getConferenceReport)` |
| 62 | POST | `/:id/generate` | - | - | `router.post('/:id/generate', generateReport)` |
| 63 | POST | `/:id/schedule` | - | - | `router.post('/:id/schedule', scheduleReport)` |
| 64 | POST | `/:id/send` | - | - | `router.post('/:id/send', sendReport)` |
| 66 | GET | `/:id/history` | - | - | `router.get('/:id/history', getReportHistory)` |
| 78 | GET | `/stats/overview` | - | - | `router.get('/stats/overview', getReportStats)` |

## backend/src/routes/restaurant-bills.routes.ts

Imports: ../controllers/restaurant-bills.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 9 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 14 | POST | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]) | - | `router.post('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]), billsController.createBill )` |
| 20 | GET | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.get('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), billsController.getBillDetails )` |
| 26 | POST | `/search` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER]) | - | `router.post('/search', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER]), billsController.searchOpenBills )` |
| 32 | GET | `/open` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER]) | - | `router.get('/open', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER]), billsController.getOpenBills )` |
| 38 | POST | `/:id/orders` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]) | - | `router.post('/:id/orders', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]), billsController.addOrderToBill )` |
| 44 | PUT | `/:id/close` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]) | - | `router.put('/:id/close', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]), billsController.closeBill )` |
| 52 | POST | `/:id/payments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CASHIER, UserRole.BRANCH_MANAGER]) | - | `router.post('/:id/payments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CASHIER, UserRole.BRANCH_MANAGER]), billsController.recordPayment )` |
| 58 | GET | `/:id/payments` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/:id/payments', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]), billsController.getPaymentHistory )` |
| 64 | POST | `/:id/payments/:paymentId/reverse` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]) | - | `router.post('/:id/payments/:paymentId/reverse', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), billsController.reversePayment )` |
| 72 | POST | `/:id/split/by-items` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]) | - | `router.post('/:id/split/by-items', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]), billsController.splitBillByItems )` |
| 80 | POST | `/merge` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]) | - | `router.post('/merge', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]), billsController.mergeBills )` |
| 88 | POST | `/orders/:id/void-request` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]) | - | `router.post('/orders/:id/void-request', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]), billsController.requestVoidOrder )` |
| 94 | POST | `/void-requests/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]) | - | `router.post('/void-requests/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), billsController.approveVoidRequest )` |
| 100 | GET | `/void-requests/pending` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/void-requests/pending', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), billsController.getPendingVoidRequests )` |
| 108 | GET | `/:id/audit-log` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/:id/audit-log', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]), billsController.getBillAuditLog )` |

## backend/src/routes/restaurant.reservation.routes.ts

Imports: ../controllers/restaurant.reservation.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 19 | GET | `/availability` | - | - | `router.get('/availability', checkAvailability)` |
| 22 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 24 | GET | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT]), getReservations )` |
| 29 | GET | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT]) | - | `router.get('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT]), getReservationById )` |
| 34 | POST | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]) | - | `router.post('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]), createReservation )` |
| 39 | PUT | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), updateReservation )` |
| 44 | PUT | `/:id/confirm` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/:id/confirm', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), confirmReservation )` |
| 49 | PUT | `/:id/seat` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/:id/seat', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), seatReservation )` |
| 54 | PUT | `/:id/cancel` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/:id/cancel', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), cancelReservation )` |
| 59 | PUT | `/:id/no-show` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/:id/no-show', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), markNoShow )` |

## backend/src/routes/restaurant.routes.ts

Imports: ../config/supabase<br>../controllers/restaurant.controller<br>../controllers/restaurant/wastage.controller<br>../middleware/auth<br>../models/User<br>./restaurant.reservation.routes<br>./restaurant.table.routes<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 42 | GET | `/menu/categories` | - | - | `router.get('/menu/categories', getMenuCategories)` |
| 43 | GET | `/menu/items` | - | - | `router.get('/menu/items', getMenuItems)` |
| 46 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 49 | GET | `/orders/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST]) | - | `router.get('/orders/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST]), getOrder )` |
| 55 | POST | `/orders` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]) | - | `router.post('/orders', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]), createOrder )` |
| 60 | GET | `/orders` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN, Us) | - | `router.get('/orders', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN, UserRole.AUDITOR]), getOrders )` |
| 65 | POST | `/orders/:id/items` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]) | - | `router.post('/orders/:id/items', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]), addItemsToOrder )` |
| 71 | POST | `/menu/items` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.post('/menu/items', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), createMenuItem )` |
| 76 | PUT | `/menu/items/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/menu/items/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), updateMenuItem )` |
| 81 | DELETE | `/menu/items/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.delete('/menu/items/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), deleteMenuItem )` |
| 86 | PUT | `/menu/items/:id/toggle` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/menu/items/:id/toggle', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), toggleItemAvailability )` |
| 92 | POST | `/menu/items/:id/image` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.post('/menu/items/:id/image', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), uploadMenuItemImage )` |
| 97 | DELETE | `/menu/items/:id/image` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.delete('/menu/items/:id/image', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), deleteMenuItemImage )` |
| 102 | PUT | `/orders/:id/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]) | - | `router.put('/orders/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]), updateOrderStatus )` |
| 107 | GET | `/inventory` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.get('/inventory', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), getInventoryItems )` |
| 112 | POST | `/inventory/:id/stock` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.post('/inventory/:id/stock', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), updateInventoryStock )` |
| 118 | POST | `/room-service` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]) | - | `router.post('/room-service', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]), createRoomServiceOrder )` |
| 123 | GET | `/room-service` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]) | - | `router.get('/room-service', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]), getRoomServiceOrders )` |
| 128 | PUT | `/room-service/:id/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/room-service/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), updateRoomServiceOrderStatus )` |
| 134 | GET | `/reports/daily-sales` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN, UserRole.AUDITOR]) | - | `router.get('/reports/daily-sales', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN, UserRole.AUDITOR]), getDailySales )` |
| 140 | GET | `/kitchen/orders` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]) | - | `router.get('/kitchen/orders', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]), async (req, res) => { try { const branchIdRaw = req.query.branch_id as string; cons` |
| 208 | PUT | `/kitchen/orders/:orderId/items/:itemId/ready` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN]) | - | `router.put('/kitchen/orders/:orderId/items/:itemId/ready', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN]), async (req, res) => { try { const { orderId, itemId } = req.params; res.json({ success: true, message` |
| 227 | GET | `/wastage/items` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]) | - | `router.get('/wastage/items', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]), getWastageItems )` |
| 233 | GET | `/wastage` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]) | - | `router.get('/wastage', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]), getWastageRecords )` |
| 239 | GET | `/wastage/summary` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]) | - | `router.get('/wastage/summary', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.BRANCH_MANAGER, UserRole.POS_KITCHEN]), getWastageSummary )` |
| 245 | POST | `/wastage` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]) | - | `router.post('/wastage', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]), createWastageRecord )` |
| 251 | PUT | `/wastage/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]) | - | `router.put('/wastage/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN, UserRole.POS_KITCHEN]), updateWastageRecord )` |
| 257 | DELETE | `/wastage/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN]) | - | `router.delete('/wastage/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.KITCHEN]), deleteWastageRecord )` |
| 263 | USE | `/tables` | - | - | `router.use('/tables', tableRoutes)` |
| 264 | USE | `/reservations` | - | - | `router.use('/reservations', reservationRoutes)` |

## backend/src/routes/restaurant.table.routes.ts

Imports: ../controllers/restaurant.table.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 19 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 22 | GET | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]) | - | `router.get('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]), getTables )` |
| 27 | GET | `/stats` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.get('/stats', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), getTableStats )` |
| 32 | GET | `/floor-plan` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.get('/floor-plan', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), getFloorPlan )` |
| 37 | GET | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.get('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), getTableById )` |
| 43 | PUT | `/:id/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.put('/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), updateTableStatus )` |
| 48 | POST | `/:id/assign` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]) | - | `router.post('/:id/assign', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]), assignServer )` |
| 54 | POST | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createTable )` |
| 59 | PUT | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateTable )` |
| 64 | PUT | `/floor-plan` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/floor-plan', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateFloorPlan )` |

## backend/src/routes/revenue-oversight.routes.ts

Imports: ../controllers/revenue-oversight.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 12 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 15 | GET | `/revenue-overview` | authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]) | - | `router.get( '/revenue-overview', authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]), getRevenueOverview )` |
| 29 | GET | `/revenue-oversight` | authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]) | - | `router.get( '/revenue-oversight', authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]), getRevenueOversight )` |
| 42 | GET | `/targets` | authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]) | - | `router.get( '/targets', authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]), getRevenueTargets )` |

## backend/src/routes/room.routes.ts

Imports: ../controllers/room.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 17 | GET | `/` | - | - | `router.get('/', getRooms)` |
| 18 | GET | `/types` | - | - | `router.get('/types', getRoomTypes)` |
| 19 | GET | `/:id` | - | - | `router.get('/:id', getRoom)` |
| 22 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 25 | POST | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createRoom)` |
| 26 | PUT | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateRoom)` |
| 27 | DELETE | `/:id` | authorize([UserRole.SUPER_ADMIN]) | - | `router.delete('/:id', authorize([UserRole.SUPER_ADMIN]), deleteRoom)` |
| 30 | PATCH | `/:id/status` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING, UserRole.RECEPTIONIST]) | - | `router.patch( '/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING, UserRole.RECEPTIONIST]), updateRoomStatus )` |

## backend/src/routes/search.routes.ts

Imports: ../controllers/search.controller<br>../middleware/auth.middleware<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 8 | GET | `/` | protect | - | `router.get('/', protect, globalSearch)` |

## backend/src/routes/security.routes.ts

Imports: ../controllers/security.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 9 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 10 | USE | `(middleware)` | authorize([UserRole.SUPER_ADMIN]) | - | `router.use(authorize([UserRole.SUPER_ADMIN]))` |
| 13 | GET | `/config` | - | - | `router.get('/config', securityController.getSecurityConfig)` |
| 14 | PUT | `/config` | - | - | `router.put('/config', securityController.updateSecurityConfig)` |
| 17 | GET | `/rls-policies` | - | - | `router.get('/rls-policies', securityController.getRLSPolicies)` |
| 20 | GET | `/api-metrics` | - | - | `router.get('/api-metrics', securityController.getAPISecurityMetrics)` |
| 23 | GET | `/blocked-ips` | - | - | `router.get('/blocked-ips', securityController.getBlockedIPs)` |
| 24 | POST | `/block-ip` | - | - | `router.post('/block-ip', securityController.blockIP)` |
| 25 | POST | `/unblock-ip` | - | - | `router.post('/unblock-ip', securityController.unblockIP)` |
| 28 | GET | `/active-sessions` | - | - | `router.get('/active-sessions', securityController.getActiveSessions)` |
| 29 | POST | `/terminate-session` | - | - | `router.post('/terminate-session', securityController.terminateSession)` |
| 30 | POST | `/terminate-all-sessions` | - | - | `router.post('/terminate-all-sessions', securityController.terminateAllSessions)` |

## backend/src/routes/shiftPnL.routes.ts

Imports: ../controllers/shiftPnL.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 21 | USE | `(middleware)` | - | - | `router.use(authenticateToken)` |
| 24 | POST | `/generate/:shiftId` | - | - | `router.post('/generate/:shiftId', generatePnL)` |
| 27 | POST | `/:shiftId/submit` | - | - | `router.post('/:shiftId/submit', submitPnL)` |
| 28 | POST | `/:shiftId/review` | - | - | `router.post('/:shiftId/review', reviewPnL)` |
| 29 | POST | `/:shiftId/approve` | - | - | `router.post('/:shiftId/approve', approvePnL)` |
| 32 | GET | `/summary` | - | - | `router.get('/summary', getBranchSummary)` |
| 33 | GET | `/summary/branch` | - | - | `router.get('/summary/branch', getBranchSummary)` |
| 34 | GET | `/food-cost-trend` | - | - | `router.get('/food-cost-trend', getFoodCostTrendData)` |
| 35 | GET | `/` | - | - | `router.get('/', getPnLs)` |
| 36 | GET | `/:shiftId` | - | - | `router.get('/:shiftId', getPnL)` |

## backend/src/routes/shifts.routes.ts

Imports: ../controllers/shifts.controller<br>../middleware/auth.middleware<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 24 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 27 | GET | `/templates` | authorize('branch_manager', 'super_admin', 'hr_manager') | - | `router.get('/templates', authorize('branch_manager', 'super_admin', 'hr_manager'), getShiftTemplates)` |
| 28 | POST | `/templates` | authorize('branch_manager', 'super_admin') | - | `router.post('/templates', authorize('branch_manager', 'super_admin'), createShiftTemplate)` |
| 29 | PUT | `/templates/:id` | authorize('branch_manager', 'super_admin') | - | `router.put('/templates/:id', authorize('branch_manager', 'super_admin'), updateShiftTemplate)` |
| 30 | DELETE | `/templates/:id` | authorize('branch_manager', 'super_admin') | - | `router.delete('/templates/:id', authorize('branch_manager', 'super_admin'), deleteShiftTemplate)` |
| 33 | GET | `/` | authorize('branch_manager', 'super_admin', 'hr_manager') | - | `router.get('/', authorize('branch_manager', 'super_admin', 'hr_manager'), getStaffShifts)` |
| 34 | POST | `/` | authorize('branch_manager', 'super_admin') | - | `router.post('/', authorize('branch_manager', 'super_admin'), createStaffShift)` |
| 35 | POST | `/bulk` | authorize('branch_manager', 'super_admin') | - | `router.post('/bulk', authorize('branch_manager', 'super_admin'), bulkCreateStaffShifts)` |
| 36 | PUT | `/:id` | authorize('branch_manager', 'super_admin') | - | `router.put('/:id', authorize('branch_manager', 'super_admin'), updateStaffShift)` |
| 37 | POST | `/:id/check-in` | - | - | `router.post('/:id/check-in', checkInShift)` |
| 38 | POST | `/:id/check-out` | - | - | `router.post('/:id/check-out', checkOutShift)` |
| 39 | DELETE | `/:id` | authorize('branch_manager', 'super_admin') | - | `router.delete('/:id', authorize('branch_manager', 'super_admin'), deleteStaffShift)` |
| 42 | GET | `/swaps` | authorize('branch_manager', 'super_admin', 'hr_manager') | - | `router.get('/swaps', authorize('branch_manager', 'super_admin', 'hr_manager'), getShiftSwaps)` |
| 43 | POST | `/swaps` | - | - | `router.post('/swaps', createShiftSwap)` |
| 44 | PUT | `/swaps/:id/status` | authorize('branch_manager', 'super_admin') | - | `router.put('/swaps/:id/status', authorize('branch_manager', 'super_admin'), updateShiftSwapStatus)` |
| 47 | GET | `/statistics` | authorize('branch_manager', 'super_admin', 'hr_manager') | - | `router.get('/statistics', authorize('branch_manager', 'super_admin', 'hr_manager'), getShiftStatistics)` |

## backend/src/routes/staff-audit.routes.ts

Imports: ../controllers/staff-audit.controller<br>../middleware/auth.middleware<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 12 | GET | `/audit` | authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager')<br>protect | - | `router.get('/audit', protect, authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'), getStaffAuditTrail)` |
| 15 | GET | `/audit/critical` | authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager')<br>protect | - | `router.get('/audit/critical', protect, authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'), getCriticalActions)` |
| 18 | GET | `/:id/audit-summary` | authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager')<br>protect | - | `router.get('/:id/audit-summary', protect, authorize('branch_manager', 'branch_accountant', 'auditor', 'super_admin', 'general_manager'), getStaffAuditSummary)` |

## backend/src/routes/staff-performance.routes.ts

Imports: ../controllers/staff-performance.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 13 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 16 | GET | `/` | authorize([ UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]) | - | `router.get( '/', authorize([ UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]), getStaffPerformance )` |
| 29 | GET | `/leaderboard` | authorize([ UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]) | - | `router.get( '/leaderboard', authorize([ UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]), getPerformanceLeaderboard )` |

## backend/src/routes/staff.routes.ts

Imports: ../controllers/staff.controller<br>../middleware/auth<br>../models/User<br>express<br>multer

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 44 | GET | `/roles` | - | - | `router.get('/roles', getRoles)` |
| 47 | GET | `/by-identifier/:identifier` | - | - | `router.get('/by-identifier/:identifier', getStaffByIdentifier)` |
| 50 | POST | `/attendance/clock-in` | - | - | `router.post('/attendance/clock-in', clockIn)` |
| 51 | POST | `/attendance/clock-out` | - | - | `router.post('/attendance/clock-out', clockOut)` |
| 54 | USE | `(middleware)` | - | - | `router.use((req, res, next) => { console.log('[STAFF ROUTES MIDDLEWARE] Path:', req.path, 'Method:', req.method, 'Query:', req.query); next(); })` |
| 59 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 62 | GET | `/` | - | - | `router.get('/', (req, res, next) => { console.log('[STAFF ROUTES] ✅ GET / HIT - user:', req.user?.email, 'role:', req.user?.role); console.log('[STAFF ROUTES] Query params:', req.query); console.log('[STAFF ROUTES] Headers:', req.headers.authorization?.substri` |
| 69 | POST | `/` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.post('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), createStaffMember )` |
| 75 | POST | `/schedule` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]) | - | `router.post('/schedule', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]), createStaffSchedule )` |
| 80 | POST | `/performance` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]) | - | `router.post('/performance', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]), submitPerformanceReview )` |
| 86 | POST | `/payroll` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER]) | - | `router.post('/payroll', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER]), processPayroll )` |
| 92 | GET | `/attendance` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR) | - | `router.get('/attendance', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.RECEPTIONIST]), getAttendance )` |
| 97 | GET | `/attendance/summary` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR) | - | `router.get('/attendance/summary', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getAttendanceSummary )` |
| 102 | POST | `/attendance/confirm` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]) | - | `router.post('/attendance/confirm', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]), batchConfirmAttendance )` |
| 107 | PUT | `/attendance/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]) | - | `router.put('/attendance/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]), updateAttendance )` |
| 112 | PUT | `/attendance/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.put('/attendance/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), approveAttendance )` |
| 122 | POST | `/leave/lock` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]) | - | `router.post('/leave/lock', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]), batchLockLeave )` |
| 127 | GET | `/attendance/reports` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR) | - | `router.get('/attendance/reports', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getAttendanceReports )` |
| 133 | POST | `/:id/photo` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]) | upload | `router.post('/:id/photo', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]), upload.single('photo'), uploadStaffPhoto )` |
| 140 | GET | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR) | - | `router.get('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getStaffMember )` |
| 145 | PUT | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.put('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), updateStaffMember )` |
| 150 | DELETE | `/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]) | - | `router.delete('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]), deleteStaffMember )` |
| 155 | POST | `/:id/archive` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]) | - | `router.post('/:id/archive', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]), archiveStaff )` |
| 160 | GET | `/:id/history` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR) | - | `router.get('/:id/history', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getStaffHistory )` |
| 165 | POST | `/:id/documents` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]) | upload | `router.post('/:id/documents', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]), upload.single('document'), uploadStaffDocument )` |
| 171 | GET | `/:id/documents` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR) | - | `router.get('/:id/documents', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR]), getStaffDocuments )` |
| 176 | PUT | `/leave/:id` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.put('/leave/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), updateLeaveRequest )` |
| 181 | PUT | `/leave/:id/approve` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.put('/leave/:id/approve', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), approveLeaveRequest )` |
| 186 | PUT | `/leave/:id/reject` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.put('/leave/:id/reject', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), rejectLeaveRequest )` |
| 191 | PUT | `/leave/:id/report-to-duty` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]) | - | `router.put('/leave/:id/report-to-duty', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]), reportToDuty )` |

## backend/src/routes/statutory-deductions.routes.ts

Imports: ../controllers/statutory-deductions.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 9 | GET | `/` | authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.BRANCH_OPERATIONS_MANAGER, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN ]) | - | `router.get('/', authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.BRANCH_OPERATIONS_MANAGER, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN ]), statutoryController.getMonthlyDeductions)` |
| 17 | POST | `/` | authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.BRANCH_OPERATIONS_MANAGER, UserRole.SUPER_ADMIN ]) | - | `router.post('/', authorize([ UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.BRANCH_OPERATIONS_MANAGER, UserRole.SUPER_ADMIN ]), statutoryController.createOrUpdateDeductions)` |

## backend/src/routes/stock-analytics.routes.ts

Imports: ../controllers/stock-analytics.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 25 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 26 | USE | `(middleware)` | authorize(managerRoles) | - | `router.use(authorize(managerRoles))` |
| 29 | GET | `/consumption-trends` | - | - | `router.get('/consumption-trends', getConsumptionTrends)` |
| 32 | GET | `/reorder-suggestions` | - | - | `router.get('/reorder-suggestions', getReorderSuggestions)` |
| 35 | GET | `/stock-movement` | - | - | `router.get('/stock-movement', getStockMovement)` |
| 38 | GET | `/wastage-analytics` | - | - | `router.get('/wastage-analytics', getWastageAnalytics)` |

## backend/src/routes/stock-take.routes.ts

Imports: ../controllers/stock-take.controller<br>../controllers/storekeeping/resources.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 18 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 32 | GET | `/` | authorize(AUDIT_ROLES) | - | `router.get('/', authorize(AUDIT_ROLES), getStockTakes )` |
| 38 | GET | `/worksheet` | authorize(AUDIT_ROLES) | - | `router.get('/worksheet', authorize(AUDIT_ROLES), generateWorksheet )` |
| 44 | GET | `/:id` | authorize(AUDIT_ROLES) | - | `router.get('/:id', authorize(AUDIT_ROLES), getStockTake )` |
| 50 | GET | `/:id/items` | authorize(AUDIT_ROLES) | - | `router.get('/:id/items', authorize(AUDIT_ROLES), getStockTakeItems )` |
| 56 | POST | `/` | authorize(AUDIT_ROLES) | - | `router.post('/', authorize(AUDIT_ROLES), createStockTake )` |
| 63 | PUT | `/:id` | authorize(AUDIT_ROLES) | - | `router.put('/:id', authorize(AUDIT_ROLES), updateStockTake )` |
| 70 | POST | `/:id/submit` | authorize(AUDIT_ROLES) | - | `router.post('/:id/submit', authorize(AUDIT_ROLES), completeStockTake )` |
| 76 | GET | `/:id/worksheet` | authorize(AUDIT_ROLES) | - | `router.get('/:id/worksheet', authorize(AUDIT_ROLES), generateWorksheet )` |
| 82 | GET | `/:id/worksheet-categorized` | authorize(AUDIT_ROLES) | - | `router.get('/:id/worksheet-categorized', authorize(AUDIT_ROLES), generateBranchStockTakeWorksheet )` |

## backend/src/routes/storekeeping.routes.ts

Imports: ../controllers/storekeeping/branch-inventory.controller<br>../controllers/storekeeping/branch-receipt.controller<br>../controllers/storekeeping/central-spoilage.controller<br>../controllers/storekeeping/central-stock-take.controller<br>../controllers/storekeeping/config.controller<br>../controllers/storekeeping/conversions.controller<br>../controllers/storekeeping/items.controller<br>../controllers/storekeeping/kitchen-usage.controller<br>../controllers/storekeeping/purchase-orders.controller<br>../controllers/storekeeping/resources.controller<br>../controllers/storekeeping/shop.controller<br>../controllers/storekeeping/stock-requests.controller<br>../controllers/storekeeping/transfers.controller<br>../middleware/auth<br>../middleware/moduleAccess<br>../models/User<br>express<br>multer

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 153 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 195 | POST | `/items/:id/add-stock` | authorize(staffRoles) | - | `router.post('/items/:id/add-stock', authorize(staffRoles), addStock)` |
| 198 | GET | `/items/:id/history` | authorize(staffRoles) | - | `router.get('/items/:id/history', authorize(staffRoles), getStockHistory)` |
| 205 | GET | `/categories` | authorize(staffRoles) | - | `router.get('/categories', authorize(staffRoles), getCategoriesEndpoint)` |
| 208 | POST | `/preview-sku` | authorize(staffRoles) | - | `router.post('/preview-sku', authorize(staffRoles), previewSKUEndpoint)` |
| 211 | POST | `/generate-sku` | authorize(staffRoles) | - | `router.post('/generate-sku', authorize(staffRoles), generateSKUEndpoint)` |
| 214 | POST | `/generate-barcode` | authorize(managerRoles) | - | `router.post('/generate-barcode', authorize(managerRoles), generateBarcodeEndpoint)` |
| 220 | GET | `/shop_items` | authorize(staffRoles) | - | `router.get('/shop_items', authorize(staffRoles), getShopItems)` |
| 226 | GET | `/transfer_items` | authorize(staffRoles) | - | `router.get('/transfer_items', authorize(staffRoles), getTransferItems)` |
| 228 | POST | `/transfer` | authorize(staffRoles) | - | `router.post('/transfer', authorize(staffRoles), transferItem)` |
| 229 | POST | `/submit-transfer-request` | authorize(staffRoles) | - | `router.post('/submit-transfer-request', authorize(staffRoles), submitTransferRequest)` |
| 230 | POST | `/complete-transfer` | authorize(managerRoles) | - | `router.post('/complete-transfer', authorize(managerRoles), completeTransfer)` |
| 236 | GET | `/app_config` | authorize(staffRoles) | - | `router.get('/app_config', authorize(staffRoles), getAppConfig)` |
| 237 | GET | `/get_edit_lock_status` | authorize(staffRoles) | - | `router.get('/get_edit_lock_status', authorize(staffRoles), getEditLockStatus)` |
| 238 | POST | `/set_edit_lock_status` | authorize(managerRoles) | - | `router.post('/set_edit_lock_status', authorize(managerRoles), setEditLockStatus)` |
| 240 | GET | `/export_data` | authorize(staffRoles) | - | `router.get('/export_data', authorize(staffRoles), exportDataExcel)` |
| 241 | POST | `/import_data` | authorize(managerRoles) | upload | `router.post('/import_data', authorize(managerRoles), upload.single('file') as any, importDataExcel)` |
| 247 | POST | `/conversions` | authorize(staffRoles) | - | `router.post('/conversions', authorize(staffRoles), convertStock)` |
| 248 | GET | `/yield-rules` | authorize(staffRoles) | - | `router.get('/yield-rules', authorize(staffRoles), getYieldRules)` |
| 255 | GET | `/master-catalog` | authorize(staffRoles) | - | `router.get('/master-catalog', authorize(staffRoles), getMasterCatalog)` |
| 258 | GET | `/branch-stock` | authorize(branchRoles) | - | `router.get('/branch-stock', authorize(branchRoles), getBranchStock)` |
| 259 | GET | `/branch-stock/low` | authorize(branchRoles) | - | `router.get('/branch-stock/low', authorize(branchRoles), getLowStockItems)` |
| 260 | POST | `/branch-stock/out` | authorize(branchRoles) | - | `router.post('/branch-stock/out', authorize(branchRoles), recordStockOut)` |
| 261 | POST | `/branch-stock/adjustment` | authorize(branchRoles) | - | `router.post('/branch-stock/adjustment', authorize(branchRoles), updateBranchStock)` |
| 262 | POST | `/branch-stock/receive-supplier` | authorize(branchRoles) | - | `router.post('/branch-stock/receive-supplier', authorize(branchRoles), receiveFromSupplier)` |
| 263 | GET | `/stock-movements` | authorize(branchRoles) | - | `router.get('/stock-movements', authorize(branchRoles), getStockMovements)` |
| 269 | GET | `/stock-requests/approved` | authorize(centralRoles) | - | `router.get('/stock-requests/approved', authorize(centralRoles), getApprovedRequests)` |
| 270 | GET | `/stock-requests/pending` | authorize(managerRoles) | - | `router.get('/stock-requests/pending', authorize(managerRoles), getPendingRequests)` |
| 271 | GET | `/stock-requests/branch-performance/:branchId` | authorize(auditorRoles) | - | `router.get('/stock-requests/branch-performance/:branchId', authorize(auditorRoles), getBranchPerformance)` |
| 272 | POST | `/stock-requests` | authorize(branchRoles) | - | `router.post('/stock-requests', authorize(branchRoles), createStockRequest)` |
| 273 | GET | `/stock-requests` | authorize(branchRoles) | - | `router.get('/stock-requests', authorize(branchRoles), getStockRequests)` |
| 274 | GET | `/stock-requests/:id` | authorize(branchRoles) | - | `router.get('/stock-requests/:id', authorize(branchRoles), getStockRequest)` |
| 275 | PUT | `/stock-requests/:id/review` | authorize(auditorRoles) | - | `router.put('/stock-requests/:id/review', authorize(auditorRoles), reviewStockRequest)` |
| 276 | PUT | `/stock-requests/:id/approve` | authorize(auditorRoles) | - | `router.put('/stock-requests/:id/approve', authorize(auditorRoles), approveStockRequest)` |
| 277 | PUT | `/stock-requests/:id/reject` | authorize(auditorRoles) | - | `router.put('/stock-requests/:id/reject', authorize(auditorRoles), rejectStockRequest)` |
| 280 | POST | `/dispatch-notes` | authorize(centralRoles) | - | `router.post('/dispatch-notes', authorize(centralRoles), createDispatch)` |
| 281 | GET | `/dispatch-notes` | authorize(centralRoles) | - | `router.get('/dispatch-notes', authorize(centralRoles), getDispatchHistory)` |
| 282 | PUT | `/dispatch-notes/:id/dispatch` | authorize(centralRoles) | - | `router.put('/dispatch-notes/:id/dispatch', authorize(centralRoles), dispatchItems)` |
| 283 | PUT | `/dispatch-notes/:id/logistics` | authorize(centralRoles) | - | `router.put('/dispatch-notes/:id/logistics', authorize(centralRoles), updateDispatchLogistics)` |
| 286 | GET | `/incoming-dispatches` | authorize(branchRoles) | - | `router.get('/incoming-dispatches', authorize(branchRoles), getIncomingDispatches)` |
| 287 | PUT | `/dispatch-notes/:id/confirm` | authorize(branchRoles) | - | `router.put('/dispatch-notes/:id/confirm', authorize(branchRoles), confirmDelivery)` |
| 290 | GET | `/dashboard/central` | authorize(centralRoles) | - | `router.get('/dashboard/central', authorize(centralRoles), getCentralDashboard)` |
| 291 | GET | `/dashboard/branch` | authorize(branchRoles) | - | `router.get('/dashboard/branch', authorize(branchRoles), getBranchDashboard)` |
| 292 | GET | `/branches-stock` | authorize(centralRoles) | - | `router.get('/branches-stock', authorize(centralRoles), getBranchesWithStock)` |
| 293 | GET | `/branches` | authorize(staffRoles) | - | `router.get('/branches', authorize(staffRoles), getBranchesWithStock)` |
| 294 | GET | `/valuation` | authorize(centralRoles) | - | `router.get('/valuation', authorize(centralRoles), getCentralValuation)` |
| 344 | GET | `/stock-takes/:id` | authorize(staffRoles) | - | `router.get('/stock-takes/:id', authorize(staffRoles), getStockTake)` |
| 345 | GET | `/stock-takes/:id/items` | authorize(staffRoles) | - | `router.get('/stock-takes/:id/items', authorize(staffRoles), getStockTakeItems)` |
| 346 | PUT | `/stock-takes/:id/complete` | authorize(managerRoles) | - | `router.put('/stock-takes/:id/complete', authorize(managerRoles), completeStockTake)` |
| 347 | PUT | `/stock-take-items/:id` | authorize(staffRoles) | - | `router.put('/stock-take-items/:id', authorize(staffRoles), updateStockTakeItem)` |
| 357 | GET | `/central-stock-takes/:id` | authorize(staffRoles) | - | `router.get('/central-stock-takes/:id', authorize(staffRoles), getCentralStockTake)` |
| 358 | PUT | `/central-stock-takes/:id` | authorize(managerRoles) | - | `router.put('/central-stock-takes/:id', authorize(managerRoles), updateCentralStockTake)` |
| 359 | POST | `/central-stock-takes/:id/submit` | authorize(managerRoles) | - | `router.post('/central-stock-takes/:id/submit', authorize(managerRoles), submitCentralStockTake)` |
| 360 | POST | `/central-stock-takes/:id/approve` | authorize(auditorRoles) | - | `router.post('/central-stock-takes/:id/approve', authorize(auditorRoles), approveCentralStockTake)` |
| 361 | POST | `/central-stock-takes/:id/reject` | authorize(auditorRoles) | - | `router.post('/central-stock-takes/:id/reject', authorize(auditorRoles), rejectCentralStockTake)` |
| 362 | GET | `/central-stock-takes/:id/worksheet-pdf` | authorize(staffRoles) | - | `router.get('/central-stock-takes/:id/worksheet-pdf', authorize(staffRoles), generateCentralStockTakeWorksheetPDF)` |
| 363 | GET | `/central-stock-takes/:id/excel` | authorize(staffRoles) | - | `router.get('/central-stock-takes/:id/excel', authorize(staffRoles), generateCentralStockTakeExcel)` |
| 369 | GET | `/central-spoilage` | authorize(staffRoles) | - | `router.get('/central-spoilage', authorize(staffRoles), getSpoilageRecords)` |
| 370 | GET | `/central-spoilage/summary` | authorize(staffRoles) | - | `router.get('/central-spoilage/summary', authorize(staffRoles), getSpoilageSummary)` |
| 371 | GET | `/central-spoilage/items` | authorize(staffRoles) | - | `router.get('/central-spoilage/items', authorize(staffRoles), getSpoilageItems)` |
| 372 | POST | `/central-spoilage` | authorize(managerRoles) | - | `router.post('/central-spoilage', authorize(managerRoles), createSpoilageRecord)` |
| 373 | GET | `/central-spoilage/:id` | authorize(staffRoles) | - | `router.get('/central-spoilage/:id', authorize(staffRoles), getSpoilageRecord)` |
| 374 | PATCH | `/central-spoilage/:id/status` | authorize(auditorRoles) | - | `router.patch('/central-spoilage/:id/status', authorize(auditorRoles), updateSpoilageStatus)` |
| 381 | GET | `/kitchen-usage/trackable-items` | authorize(branchRoles) | - | `router.get('/kitchen-usage/trackable-items', authorize(branchRoles), getTrackableItems)` |
| 384 | GET | `/kitchen-usage` | authorize(branchRoles) | - | `router.get('/kitchen-usage', authorize(branchRoles), getReceivedItems)` |
| 387 | POST | `/kitchen-usage` | authorize(branchRoles) | - | `router.post('/kitchen-usage', authorize(branchRoles), createUsageRecord)` |
| 390 | POST | `/kitchen-usage/:usage_record_id/entries` | authorize(branchRoles) | - | `router.post('/kitchen-usage/:usage_record_id/entries', authorize(branchRoles), recordUsageEntry)` |
| 393 | GET | `/kitchen-usage/:usage_record_id/entries` | authorize(branchRoles) | - | `router.get('/kitchen-usage/:usage_record_id/entries', authorize(branchRoles), getUsageEntries)` |
| 396 | PUT | `/kitchen-usage/:usage_record_id/close` | authorize(branchRoles) | - | `router.put('/kitchen-usage/:usage_record_id/close', authorize(branchRoles), closeUsageRecord)` |
| 399 | GET | `/kitchen-usage/staff` | authorize(branchRoles) | - | `router.get('/kitchen-usage/staff', authorize(branchRoles), getBranchStaff)` |
| 402 | GET | `/kitchen-usage/accountability` | authorize(allStoreRoles) | - | `router.get('/kitchen-usage/accountability', authorize(allStoreRoles), getStaffAccountability)` |
| 405 | GET | `/kitchen-usage/summary` | authorize(allStoreRoles) | - | `router.get('/kitchen-usage/summary', authorize(allStoreRoles), getDailyUsageSummary)` |
| 447 | PUT | `/purchase-orders/:id/approve` | authorize(managerRoles) | - | `router.put('/purchase-orders/:id/approve', authorize(managerRoles), validateModuleAccess([SourceModule.BRANCH_STORE]), enforceBranchScoping, approvePurchaseOrder )` |
| 454 | POST | `/purchase-orders/:id/approve` | authorize(managerRoles) | - | `router.post('/purchase-orders/:id/approve', authorize(managerRoles), validateModuleAccess([SourceModule.BRANCH_STORE]), enforceBranchScoping, approvePurchaseOrder )` |
| 461 | PUT | `/purchase-orders/:id/receive` | authorize(managerRoles) | - | `router.put('/purchase-orders/:id/receive', authorize(managerRoles), validateModuleAccess([SourceModule.BRANCH_STORE]), enforceBranchScoping, receivePurchaseOrder )` |
| 468 | POST | `/purchase-orders/:id/receive` | authorize(managerRoles) | - | `router.post('/purchase-orders/:id/receive', authorize(managerRoles), validateModuleAccess([SourceModule.BRANCH_STORE]), enforceBranchScoping, receivePurchaseOrder )` |
| 475 | PUT | `/purchase-orders/:id/cancel` | authorize(managerRoles) | - | `router.put('/purchase-orders/:id/cancel', authorize(managerRoles), validateModuleAccess([SourceModule.BRANCH_STORE]), enforceBranchScoping, cancelPurchaseOrder )` |
| 482 | POST | `/purchase-orders/:id/cancel` | authorize(managerRoles) | - | `router.post('/purchase-orders/:id/cancel', authorize(managerRoles), validateModuleAccess([SourceModule.BRANCH_STORE]), enforceBranchScoping, cancelPurchaseOrder )` |

## backend/src/routes/storekeeping/dispatch-notes.routes.ts

Imports: ../../controllers/storekeeping/dispatch-notes.controller<br>../../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 16 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 19 | GET | `/incoming` | - | - | `router.get('/incoming', getDispatchNotes)` |
| 28 | PUT | `/:id/status` | - | - | `router.put('/:id/status', updateDispatchStatus)` |
| 29 | PUT | `/:id/dispatch` | - | - | `router.put('/:id/dispatch', dispatchItems)` |
| 30 | PUT | `/:id/confirm-delivery` | - | - | `router.put('/:id/confirm-delivery', confirmDelivery)` |

## backend/src/routes/storekeeping/index.ts

Imports: ../../controllers/storekeeping/branch-inventory.controller<br>../../controllers/storekeeping/dashboard.controller<br>../../middleware/auth<br>./dispatch-notes.routes<br>./items.routes<br>./purchase-orders.routes<br>./resources.routes<br>./stock-requests.routes<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 18 | USE | `/items` | - | - | `router.use('/items', itemsRoutes)` |
| 19 | USE | `/stock-requests` | - | - | `router.use('/stock-requests', stockRequestsRoutes)` |
| 20 | USE | `/dispatch-notes` | - | - | `router.use('/dispatch-notes', dispatchNotesRoutes)` |
| 21 | USE | `/purchase-orders` | - | - | `router.use('/purchase-orders', purchaseOrdersRoutes)` |
| 22 | USE | `/` | - | - | `router.use('/', resourcesRoutes)` |
| 23 | GET | `/dashboard` | protect | - | `router.get('/dashboard', protect, getWarehouseDashboard)` |
| 24 | GET | `/dashboard/central` | protect | - | `router.get('/dashboard/central', protect, getCentralDashboard)` |
| 25 | GET | `/dashboard/branch` | protect | - | `router.get('/dashboard/branch', protect, getBranchDashboard)` |
| 26 | GET | `/branch-stock` | protect | - | `router.get('/branch-stock', protect, getBranchStock)` |
| 27 | GET | `/branch-stock/low` | protect | - | `router.get('/branch-stock/low', protect, getLowStockItems)` |

## backend/src/routes/storekeeping/items.routes.ts

Imports: ../../controllers/storekeeping/items.controller<br>../../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 16 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 25 | POST | `/suggest` | authorize(managerRoles) | - | `router.post('/suggest', authorize(managerRoles), suggestItemAttributes)` |
| 26 | POST | `/generate-barcode` | authorize(managerRoles) | - | `router.post('/generate-barcode', authorize(managerRoles), generateBarcodeEndpoint)` |

## backend/src/routes/storekeeping/purchase-orders.routes.ts

Imports: ../../controllers/storekeeping/purchase-orders.controller<br>../../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 17 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 29 | PUT | `/:id/approve` | - | - | `router.put('/:id/approve', approvePurchaseOrder)` |
| 30 | POST | `/:id/approve` | - | - | `router.post('/:id/approve', approvePurchaseOrder)` |
| 31 | PUT | `/:id/receive` | - | - | `router.put('/:id/receive', receivePurchaseOrder)` |
| 32 | POST | `/:id/receive` | - | - | `router.post('/:id/receive', receivePurchaseOrder)` |
| 33 | PUT | `/:id/cancel` | - | - | `router.put('/:id/cancel', cancelPurchaseOrder)` |
| 34 | POST | `/:id/cancel` | - | - | `router.post('/:id/cancel', cancelPurchaseOrder)` |

## backend/src/routes/storekeeping/resources.routes.ts

Imports: ../../controllers/storekeeping/resources.controller<br>../../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 22 | USE | `(middleware)` | protect | - | `router.use(protect)` |

## backend/src/routes/storekeeping/stock-requests.routes.ts

Imports: ../../controllers/storekeeping/stock-requests.controller<br>../../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 18 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 25 | GET | `/branch-performance/:branchId` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]) | - | `router.get('/branch-performance/:branchId', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), getBranchPerformance)` |
| 28 | POST | `/bulk-approve` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.post('/bulk-approve', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), bulkApproveStockRequests)` |
| 33 | PUT | `/:id/review` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/:id/review', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), reviewStockRequest)` |
| 36 | PUT | `/:id/approve` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/:id/approve', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), approveStockRequest)` |
| 37 | PUT | `/:id/reject` | authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.put('/:id/reject', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), rejectStockRequest)` |
| 39 | PUT | `/:id/cancel` | - | - | `router.put('/:id/cancel', cancelStockRequest)` |

## backend/src/routes/suppliers.routes.ts

Imports: ../controllers/suppliers.controller<br>../middleware/auth.middleware<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 19 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 22 | GET | `/` | authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin') | - | `router.get('/', authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin'), getSuppliers)` |
| 23 | GET | `/:id` | authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin') | - | `router.get('/:id', authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin'), getSupplierById)` |
| 24 | POST | `/` | authorize('branch_storekeeper', 'central_storekeeper', 'super_admin') | - | `router.post('/', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), createSupplier)` |
| 25 | PUT | `/:id` | authorize('branch_storekeeper', 'central_storekeeper', 'super_admin') | - | `router.put('/:id', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), updateSupplier)` |
| 26 | DELETE | `/:id` | authorize('branch_storekeeper', 'central_storekeeper', 'super_admin') | - | `router.delete('/:id', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), deleteSupplier)` |
| 29 | GET | `/:supplierId/products` | authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin') | - | `router.get('/:supplierId/products', authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin'), getSupplierProducts)` |
| 30 | POST | `/:supplierId/products` | authorize('branch_storekeeper', 'central_storekeeper', 'super_admin') | - | `router.post('/:supplierId/products', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), addSupplierProduct)` |
| 31 | PUT | `/products/:productId` | authorize('branch_storekeeper', 'central_storekeeper', 'super_admin') | - | `router.put('/products/:productId', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), updateSupplierProduct)` |
| 32 | DELETE | `/products/:productId` | authorize('branch_storekeeper', 'central_storekeeper', 'super_admin') | - | `router.delete('/products/:productId', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), deleteSupplierProduct)` |
| 35 | GET | `/:supplierId/performance` | authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin') | - | `router.get('/:supplierId/performance', authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin'), getSupplierPerformance)` |

## backend/src/routes/system.routes.ts

Imports: ../controllers/system.controller<br>../middleware/auth<br>../models/User<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 17 | GET | `/branches` | - | - | `router.get('/branches', getBranches)` |
| 20 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 26 | GET | `/users` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]) | - | `router.get('/users', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), getSystemUsers )` |
| 50 | GET | `/roles` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]) | - | `router.get('/roles', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]), getRoles )` |
| 55 | GET | `/roles/:id/permissions` | authorize([UserRole.SUPER_ADMIN]) | - | `router.get('/roles/:id/permissions', authorize([UserRole.SUPER_ADMIN]), getRolePermissions )` |

## backend/src/routes/user.routes.ts

Imports: ../controllers/user.controller<br>../middleware/auth<br>../models/User<br>../services/upload.service<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 21 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 24 | GET | `/profile` | - | - | `router.get('/profile', getUserProfile)` |
| 25 | PUT | `/profile` | - | - | `router.put('/profile', updateUserProfile)` |
| 26 | PUT | `/password` | - | - | `router.put('/password', updateUserPassword)` |
| 27 | POST | `/profile/photo` | - | - | `router.post( '/profile/photo', uploadService.uploadSingle('photo'), uploadProfilePhoto )` |
| 32 | POST | `/:id/photo` | - | - | `router.post( '/:id/photo', uploadService.uploadSingle('photo'), uploadProfilePhoto )` |
| 39 | USE | `(middleware)` | authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]) | - | `router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]))` |
| 46 | POST | `/test` | - | - | `router.post('/test', testCreateUser)` |

## backend/src/routes/vendor-performance.routes.ts

Imports: ../middleware/auth<br>../models/User<br>../services/vendor-performance.service<br>../utils/logger<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 14 | GET | `/performance` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ])<br>protect | - | `router.get( '/performance', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ]), async (req, res) => { try { const vendorPerformance = await vendorPerformanceService.getAllVendorPerformance(); res.json(vendorPer` |
| 41 | GET | `/performance/:id` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ])<br>protect | - | `router.get( '/performance/:id', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ]), async (req, res) => { try { const vendorId = parseInt(req.params.id); if (isNaN(vendorId)) { return res.status(400).json({ suc` |
| 77 | POST | `/deliveries` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ])<br>protect | - | `router.post( '/deliveries', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ]), async (req, res) => { try { const delivery = req.body; if (!delivery.vendor_id \|\| !delivery.purchase_order_id \|\| !delivery.deliver` |
| 113 | POST | `/ratings` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ])<br>protect | - | `router.post( '/ratings', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER ]), async (req, res) => { try { const rating = { ...req.body, created_by: req.user.id }; if (!rating.vendor_id \|\| !rating.category \|\| !ra` |
| 152 | GET | `/rankings` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.GENERAL_MANAGER ])<br>protect | - | `router.get( '/rankings', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.GENERAL_MANAGER ]), async (req, res) => { try { const { category } = req.query; const rankings = await vendorPerformanceService.getVendorRankings( category ?` |
| 184 | GET | `/report` | authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.GENERAL_MANAGER ])<br>protect | - | `router.get( '/report', protect, authorize([ UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.GENERAL_MANAGER ]), async (req, res) => { try { const { vendor_id, category } = req.query; const report = await vendorPerformanceService.generatePerformanceRep` |

## backend/src/routes/verify.routes.ts

Imports: express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 6 | POST | `/` | - | - | `router.post('/', (req: Request, res: Response) => { try { const branch = req.body.branch; let branchName = ''; if (Array.isArray(branch) && branch.length > 0) { branchName = (branch[0] as { name: string }).name; } else if (branch && typeof branch.name === 'str` |

## backend/src/routes/waiter-sales.routes.ts

Imports: ../controllers/waiter-sales.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 11 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 14 | GET | `/waiter-sales` | authorize([ UserRole.BRANCH_MANAGER, UserRole.RESTAURANT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]) | - | `router.get( '/waiter-sales', authorize([ UserRole.BRANCH_MANAGER, UserRole.RESTAURANT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]), getWaiterSales )` |
| 26 | GET | `/waiter/:id/performance` | authorize([ UserRole.BRANCH_MANAGER, UserRole.RESTAURANT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]) | - | `router.get( '/waiter/:id/performance', authorize([ UserRole.BRANCH_MANAGER, UserRole.RESTAURANT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER ]), getWaiterPerformance )` |

## backend/src/routes/wastage.routes.ts

Imports: ../controllers/wastage.controller<br>../middleware/auth<br>express

| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |
|---:|---|---|---|---|---|
| 15 | USE | `(middleware)` | protect | - | `router.use(protect)` |
| 18 | POST | `/` | - | - | `router.post('/', createWastageRecord)` |
| 19 | POST | `/bulk` | - | - | `router.post('/bulk', bulkCreateWastageRecords)` |
| 20 | GET | `/` | - | - | `router.get('/', getWastageRecords)` |
| 21 | GET | `/summary` | - | - | `router.get('/summary', getWastageSummary)` |
| 22 | PUT | `/:id` | - | - | `router.put('/:id', updateWastageRecord)` |
| 23 | DELETE | `/:id` | - | - | `router.delete('/:id', deleteWastageRecord)` |
