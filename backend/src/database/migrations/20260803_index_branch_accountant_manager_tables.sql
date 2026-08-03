-- Migration: 20260803_index_branch_accountant_manager_tables.sql
-- Description: Comprehensive database query optimization & multi-branch indexing for Branch Accountant and Branch Manager modules.

-- ============================================================================
-- 1. BRANCH ACCOUNTANT MODULE INDEXES
-- ============================================================================

-- Master Bill Settlements & Cross-Outlet Collection Ledger
CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_branch_status 
ON pos_master_bill_settlements(branch_id, status, created_at DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_supplying_outlet 
ON pos_master_bill_settlements(supplying_outlet_id, status) 
WHERE supplying_outlet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_collecting_outlet 
ON pos_master_bill_settlements(collecting_outlet_id, status) 
WHERE collecting_outlet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_master_bills_branch_status 
ON pos_master_bills(branch_id, status, created_at DESC) 
WHERE branch_id IS NOT NULL;

-- Shift Logs & Cashier Shifts Reconciliation
CREATE INDEX IF NOT EXISTS idx_shift_logs_branch_status_opened 
ON shift_logs(branch_id, status, opened_at DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shift_logs_user_status 
ON shift_logs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_cashier_shifts_branch_status_opened 
ON cashier_shifts(branch_id, status, opened_at DESC) 
WHERE branch_id IS NOT NULL;

-- Financial Daily Closes
CREATE INDEX IF NOT EXISTS idx_daily_financial_closes_branch_date 
ON daily_financial_closes(branch_id, log_date DESC, status) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_daily_logs_branch_date 
ON finance_daily_logs(branch_id, log_date DESC) 
WHERE branch_id IS NOT NULL;

-- Credit Bills & Guest Folio Audits
CREATE INDEX IF NOT EXISTS idx_credit_bills_branch_status_verified 
ON credit_bills(branch_id, status, auditor_verified, created_at DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_bills_guest_id 
ON credit_bills(guest_id) 
WHERE guest_id IS NOT NULL;

-- Event / Banquet Orders
CREATE INDEX IF NOT EXISTS idx_event_orders_branch_event_date 
ON event_orders(branch_id, status, event_date DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_orders_customer_id 
ON event_orders(customer_id) 
WHERE customer_id IS NOT NULL;

-- Payroll Records & Simplified Payroll
CREATE INDEX IF NOT EXISTS idx_payroll_records_branch_period 
ON payroll_records(branch_id, period_start, period_end, status) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_simplified_payroll_branch_employee 
ON simplified_payroll(branch_id, employee_id, status) 
WHERE branch_id IS NOT NULL;

-- Spoilage, Wastage & Food Controls
CREATE INDEX IF NOT EXISTS idx_spoilage_records_branch_status 
ON spoilage_records(branch_id, status, created_at DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_food_control_daily_logs_branch_date 
ON food_control_daily_logs(branch_id, log_date DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bar_stock_requests_branch_status 
ON bar_stock_requests(branch_id, workflow_status, created_at DESC) 
WHERE branch_id IS NOT NULL;

-- ============================================================================
-- 2. BRANCH MANAGER MODULE INDEXES
-- ============================================================================

-- Bookings & Hotel Reservations
CREATE INDEX IF NOT EXISTS idx_reservations_branch_status_dates 
ON reservations(branch_id, status, check_in_date, check_out_date) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_guest_branch 
ON reservations(guest_id, branch_id, created_at DESC) 
WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_branch_status_dates 
ON bookings(branch_id, status, check_in_date, check_out_date) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_guest_branch 
ON bookings(guest_id, branch_id, created_at DESC) 
WHERE guest_id IS NOT NULL;

-- Rooms & Housekeeping Operations
CREATE INDEX IF NOT EXISTS idx_rooms_branch_type_status 
ON rooms(branch_id, room_type_id, status, is_active) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_branch_status 
ON housekeeping_tasks(branch_id, status, scheduled_date DESC, room_id) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_housekeeping_logs_room_id 
ON housekeeping_logs(room_id, created_at DESC);

-- Staff Profiles, Attendance & Leave
CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_role_status 
ON staff_profiles(branch_id, role, status, is_active) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_branch_role_status 
ON users(branch_id, role, status, is_active) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_attendance_branch_staff_date 
ON staff_attendance(branch_id, staff_id, date DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_branch_staff_status 
ON leave_requests(branch_id, staff_id, status, start_date) 
WHERE branch_id IS NOT NULL;

-- POS Restaurant & Waiter Sales Orders
CREATE INDEX IF NOT EXISTS idx_pos_orders_branch_outlet_status 
ON pos_orders(branch_id, outlet_id, status, created_at DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_orders_waiter_cashier 
ON pos_orders(waiter_id, cashier_id, status) 
WHERE waiter_id IS NOT NULL OR cashier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_order_items_order_status 
ON pos_order_items(order_id, status) 
WHERE order_id IS NOT NULL;

-- Branch Store & Dispatch Oversight
CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch_location 
ON branch_inventory(branch_id, location_id, item_id) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_dispatch_notes_branch_status 
ON stock_dispatch_notes(branch_id, status, created_at DESC) 
WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_branch_daily_summaries_date 
ON branch_daily_summaries(branch_id, summary_date DESC) 
WHERE branch_id IS NOT NULL;
