-- Migration: 20260804_index_staff_accounts_tables.sql
-- Description: Query optimisation for the Branch Accountant "Staff Accounts" screen
--   (Credit Bills, Salary Advances, Staff Loans, Salaries, Payroll adjustments).
--   These tables previously had no indexes on their branch/staff/status/date
--   filter & order columns, forcing sequential scans on every tab load and
--   contributing to slow fetches. Composite B-Tree indexes below match the exact
--   WHERE / ORDER BY / JOIN columns used by:
--     - credit-bills.controller.getCreditBills   (staff_credit_bills)
--     - advances.controller.getAdvances          (staff_advances)
--     - loans.controller.getLoans / recordPayment (staff_loans, staff_loan_payments)
--     - payroll-adjustments.controller           (staff_payroll_adjustments)
--   (staff_profiles / users are already covered by 20260803_index_branch_accountant_manager_tables.sql.)
--
-- Idempotent: safe to re-run (CREATE INDEX IF NOT EXISTS).

-- ============================================================================
-- Staff Credit Bills  — filter: branch_id, status, staff_id | order: bill_date DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_branch_date
  ON staff_credit_bills (branch_id, bill_date DESC)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_branch_status
  ON staff_credit_bills (branch_id, status)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_staff
  ON staff_credit_bills (staff_id);

-- ============================================================================
-- Salary Advances  — filter: branch_id, status, staff_id | order: created_at DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_advances_branch_date
  ON staff_advances (branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_advances_branch_status
  ON staff_advances (branch_id, status)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_advances_staff
  ON staff_advances (staff_id);

-- ============================================================================
-- Staff Loans  — filter: branch_id, status, staff_id | order: created_at DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_loans_branch_date
  ON staff_loans (branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_loans_branch_status
  ON staff_loans (branch_id, status)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_loans_staff
  ON staff_loans (staff_id);

-- Loan repayments — looked up / summed by loan_id
CREATE INDEX IF NOT EXISTS idx_staff_loan_payments_loan
  ON staff_loan_payments (loan_id);

-- ============================================================================
-- Payroll Adjustments (Salaries → Adjust)  — filter: staff_id / branch_id +
-- period_year + period_month | order: created_at DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_staff_period
  ON staff_payroll_adjustments (staff_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_branch_period
  ON staff_payroll_adjustments (branch_id, period_year, period_month)
  WHERE branch_id IS NOT NULL;

-- ============================================================================
-- Refresh planner statistics so the new indexes are used immediately.
-- ============================================================================
ANALYZE staff_credit_bills;
ANALYZE staff_advances;
ANALYZE staff_loans;
ANALYZE staff_loan_payments;
ANALYZE staff_payroll_adjustments;
