-- Cashier Station High-Performance Database Indexes
-- Created: 2026-07-29

-- 1. Cashier shifts and logs
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_user_status ON cashier_shifts (cashier_id, status);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_branch_status ON cashier_shifts (branch_id, status, shift_start DESC);
CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_shift_id ON cashier_shift_logs (shift_id);

-- 2. Cashier transactions
CREATE INDEX IF NOT EXISTS idx_cashier_transactions_branch_date ON cashier_transactions (branch_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_cashier_transactions_shift_id ON cashier_transactions (shift_id);

-- 3. Void requests (whole-order and item-level voids)
CREATE INDEX IF NOT EXISTS idx_pos_void_requests_shift_status ON pos_void_requests (shift_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_void_requests_status_created ON pos_void_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_item_void_requests_shift_status ON pos_item_void_requests (shift_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_item_void_requests_status_created ON pos_item_void_requests (status, created_at DESC);

-- 4. Credit bills
CREATE INDEX IF NOT EXISTS idx_credit_bills_branch_approval ON credit_bills (branch_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_credit_bills_customer_name ON credit_bills (customer_name);
CREATE INDEX IF NOT EXISTS idx_credit_bills_bill_number ON credit_bills (bill_number);

-- 5. Unpaid bills search and status indexing
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_status_branch ON unpaid_bills (status, branch_id, bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_bill_number ON unpaid_bills (bill_number);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_customer_name ON unpaid_bills (customer_name);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_guest_name ON unpaid_bills (guest_name);

-- 6. POS shift transactions, orders, and outlet shifts
CREATE INDEX IF NOT EXISTS idx_cst_payment_voided ON cashier_shift_transactions (payment_method, is_voided, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cst_transaction_ref ON cashier_shift_transactions (transaction_ref);
CREATE INDEX IF NOT EXISTS idx_cst_shift_id ON cashier_shift_transactions (shift_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_shifts_branch_status ON pos_outlet_shifts (branch_id, status, opened_at DESC);

-- 7. POS, Restaurant, and Bar orders payment status lookup
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_payment_status_branch ON restaurant_orders (payment_status, status, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bar_orders_payment_status_branch ON bar_orders (payment_status, status, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_payment_status_branch ON pos_shift_orders (payment_status, branch_id, created_at DESC);
