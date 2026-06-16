# Branch Accountant Module: Full Audit & Alignment Report

## 1. Branch Accountant Screen Inventory

The Flutter application (`BranchAccountantDashboard`) implements the following screens/sections:

| Section Enum | Screen Name | Core Purpose | Primary API / Data Source |
| :--- | :--- | :--- | :--- |
| `overview` | Overview | Dashboard metrics and quick links | `/finance/workspace/daily`, `/finance/director/tasks`, `/finance/discrepancies` |
| `search` | Branch Search | Switch branch context | `branches` table |
| `shiftReview` | Shift Reconciliation | Review cashier shifts | `/cashier/shift-logs` |
| `shiftOpenings` | Shift Openings | Approve shift openings | `/cashier/shift-openings` |
| `cashierLogbooks` | Cashier Logbooks | Historical shift logs | `/cashier/logbooks` |
| `creditBills` | Credit Bills | Manage credit customers | `/finance/credit-bills` |
| `payments` | Payments & Invoices | Track inbound payments | `/finance/payments` |
| `bookingsInvoices` | Bookings & Invoices | Hotel bookings finance | `/bookings` |
| `outboundPayments` | Outbound Payments | Supplier/expense payouts | `/branch-payments` |
| `salesPayments` | Sales & Payments | Granular POS transaction view | `/finance/sales` |
| `staffAudit` | Staff Audit | Staff financial tracking | `/finance/staff-audit` |
| `voidApprovals` | Void Approvals | Approve POS voids | `/pos/voids` |
| `discrepancies` | Discrepancies | Auditor/Director flags | `/finance/discrepancies` |
| `financialWorkspace` | Financial Workspace | Daily Revenue/COGS/Expense entry | `/finance/workspace/daily` |
| `financialClose` | Daily Close | Submit to Director/Auditor | `/finance/workspace/close` |
| `branchPayroll` | Branch Payroll | Staff payroll management | `/payroll-adjustments` |
| `analytics` | Branch Analytics | Financial analytics & charts | `/analytics/branch-sales` |
| `revenueOversight` | Revenue Oversight | Deep dive into revenue streams | `/analytics/revenue` |
| `profitLoss` | Profit & Loss | P&L Statement | `/finance/branch-financials` |
| `soldItems` | Sold Items | Items sold report | `/inventory/sold-items` |
| `stockTake` | Stock Takes | Branch inventory audit | `/inventory/stock-takes` |
| `inventoryJournals` | Inventory Journals | Movement logs | `/inventory/movements` |
| `supplierFinance` | Supplier Finance | Supplier invoices & POs | `/procurement/invoices` |

---

## 2. API Dependency Report

| Endpoint | Method | Purpose | Backend Controller | DB Table |
| :--- | :--- | :--- | :--- | :--- |
| `/finance/workspace/daily` | GET | Fetch daily records | `getDailyRecords` | `daily_financial_records` |
| `/finance/workspace/daily/:date` | GET | Fetch specific day | `getDailyRecordByDate` | `daily_financial_records` |
| `/finance/workspace/daily` | POST | Save draft daily record | `saveDailyRecord` | `daily_financial_records` |
| `/finance/workspace/daily/autofill` | GET | Lina AI smart autofill | `getDailyAutofill` | `daily_financial_records` + operational |
| `/finance/workspace/close` | POST | Generate system snapshot & variance | `submitWorkspaceClose` | `financial_workspace_submissions`, `financial_daily_snapshots` |
| `/finance/workspace/submissions/:id/explain` | POST | Submit variance explanation | `submitVarianceExplanation` | `financial_workspace_submissions` |
| `/finance/workspace/submissions/:id/post` | POST | Post to Auditor/Director | `postWorkspaceSubmission` | `financial_workspace_submissions` |
| `/finance/workspace/monthly` | GET | Fetch monthly adjustments | `getMonthlyAdjustments` | `monthly_financial_adjustments` |
| `/finance/workspace/monthly` | POST | Save monthly adjustment | `saveMonthlyAdjustment` | `monthly_financial_adjustments` |
| `/finance/director/tasks` | GET | Fetch tasks from director | `getDirectorTasks` | `director_review_tasks` |
| `/finance/director/tasks/:id/respond` | PATCH | Respond to director task | `respondToTask` | `director_review_tasks` |
| `/finance/discrepancies` | GET | Fetch auditor flags | `getFlags` | `discrepancy_flags` |
| `/finance/discrepancies/:id/respond` | PATCH | Respond to auditor flag | `respondToFlag` | `discrepancy_flags` |

---

## 3. Old DB vs New DB Comparison & Missing Objects

A comprehensive comparison between the backend expectations and the current new database schema reveals **CRITICAL GAPS**. 

Several tables actively used by the backend controllers do not exist in the new migrations.

### Missing Tables
1. **`daily_financial_records`**: MISSING. Controller `financial-workspace.controller.ts` relies on it for draft workspaces.
2. **`monthly_financial_adjustments`**: MISSING. Controller `financial-workspace.controller.ts` relies on it for monthly overheads.
3. **`director_review_tasks`**: MISSING. Controller `director-tasks.controller.ts` relies on it.

### Existing (Migrated) Tables
1. `financial_workspace_submissions` (Migrated in `20260613_financial_governance.sql`)
2. `financial_daily_snapshots` (Migrated in `20260613_financial_governance.sql`)
3. `discrepancy_flags` (Migrated in `20260524_comprehensive_schema_fix.sql`)
4. `finance_daily_logs` / `finance_daily_log_lines` (Legacy/Old tables from `20260207_finance_daily_logs.sql` - completely superseded by `daily_financial_records`).

### Missing Views
The migration `20260613_financial_governance.sql` attempts to create a view `branch_profitability_summary` reading from `daily_financial_records`. Because the table is missing, this view is broken.

---

## 4. Business Logic Gap Report & Data Integrity

**Financial Close Workflow:**
1. Accountant saves Draft to `daily_financial_records` (Broken: table missing).
2. Accountant Submits -> Backend generates `financial_daily_snapshots` and compares it to `daily_financial_records`. 
3. Backend generates variance and inserts into `financial_workspace_submissions` (Working: tables exist).
4. If Variance < -500, Accountant provides Explanation (Working).
5. Accountant Posts to Auditor/Director (Working).

**Director Tasks Workflow:**
1. Director creates task in `director_review_tasks` (Broken: table missing).
2. Accountant responds to task (Broken).

**Monthly Adjustments:**
1. Accountant enters electricity, rent, salaries, etc.
2. Saved to `monthly_financial_adjustments` (Broken: table missing).

---

## 5. API-to-New-DB & Flutter-to-New-DB Alignment

**Flutter:** The Flutter app is perfectly aligned with the APIs. `financial_close_screen.dart` correctly calls `/finance/workspace/close`, handles variance analysis, and submits explanations. `branch_accountant_dashboard.dart` correctly handles the `/finance/workspace/daily` JSON structures (e.g., `revenue_data`, `payment_data`, `banking_data`, `cogs_data`, `expense_data`).

**Backend APIs:** The APIs are correctly implemented but will fail at runtime because the underlying PostgreSQL tables do not exist.

---

## 6. SQL Repair Scripts (Database Refactoring Plan)

To make the Branch Accountant module fully functional on the new database, we must inject the missing tables immediately.

### Action Plan:
Create a new migration script `20260614_branch_accountant_schema_alignment.sql` to generate the missing tables based strictly on the backend TypeScript controllers.


---

## 7. Next Steps & Fix Application

We have created the SQL script `20260614_branch_accountant_schema_alignment.sql` inside `database/migrations/` which creates the three critically missing tables:

1. `daily_financial_records`
2. `monthly_financial_adjustments`
3. `director_review_tasks`

And updates the `branch_profitability_summary` view to point to the newly created `daily_financial_records` table.

Once this script is applied, the backend controllers will map correctly to the database, and the Flutter app's Branch Accountant module will be fully aligned and functional across all layers: Database -> API -> Flutter.

*(Note: This migration has now been automatically successfully applied to the `DATABASE_URL_NEW` environment.)*
