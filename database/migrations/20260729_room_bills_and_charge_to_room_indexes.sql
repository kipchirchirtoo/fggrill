-- Room Bills and Charge-to-Room High-Performance Indexes
-- Created: 2026-07-29

-- 1. Folios table indexes for instant room bill calculation and charging
CREATE INDEX IF NOT EXISTS idx_folios_reservation_status ON folios (reservation_id, status);
CREATE INDEX IF NOT EXISTS idx_folios_guest_branch_status ON folios (guest_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_folios_updated_at ON folios (updated_at DESC);

-- 2. Folio transactions table indexes
CREATE INDEX IF NOT EXISTS idx_folio_transactions_folio_id_type ON folio_transactions (folio_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_folio_transactions_branch_status ON folio_transactions (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_folio_transactions_created_at ON folio_transactions (created_at DESC);

-- 3. Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_folio_id ON transactions (folio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_performed_by ON transactions (performed_by);

-- 4. Cashier unpaid_bills table indexes for rapid lookup and room charge settlement
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_status_branch ON unpaid_bills (status, branch_id, bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_bill_number ON unpaid_bills (bill_number);

-- 5. Kyogong POS shift orders & master bills lookup indexes
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_short_order ON pos_shift_orders (short_code, order_number);
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_payment_status_method ON pos_shift_orders (payment_status, payment_method, branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_master_bills_number ON pos_master_bills (master_bill_number);
