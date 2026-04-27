-- Migration to add migration tracking columns to bar_orders and pos_transactions
-- for the purpose of auto-migrating unpaid bills to staff deductions

-- 1. Update bar_orders
ALTER TABLE bar_orders ADD COLUMN IF NOT EXISTS migrated_to_credit_bill BOOLEAN DEFAULT FALSE;
ALTER TABLE bar_orders ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;
ALTER TABLE bar_orders ADD COLUMN IF NOT EXISTS credit_bill_id UUID REFERENCES staff_credit_bills(id);

-- 2. Update pos_transactions
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS migrated_to_credit_bill BOOLEAN DEFAULT FALSE;
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS credit_bill_id UUID REFERENCES staff_credit_bills(id);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bar_orders_migration ON bar_orders(migrated_to_credit_bill, created_at) WHERE migrated_to_credit_bill = false;
CREATE INDEX IF NOT EXISTS idx_pos_transactions_migration ON pos_transactions(migrated_to_credit_bill, created_at) WHERE migrated_to_credit_bill = false;

-- 4. Add comments
COMMENT ON COLUMN bar_orders.migrated_to_credit_bill IS 'Indicates if pending bar order was auto-migrated to staff credit bills';
COMMENT ON COLUMN pos_transactions.migrated_to_credit_bill IS 'Indicates if pending POS transaction was auto-migrated to staff credit bills';
