-- Migration to add reconciliation columns to order tables
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS matched_transaction_id UUID REFERENCES accounting_bank_transactions(id);

ALTER TABLE bar_orders ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT FALSE;
ALTER TABLE bar_orders ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bar_orders ADD COLUMN IF NOT EXISTS matched_transaction_id UUID REFERENCES accounting_bank_transactions(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_reconciled ON restaurant_orders(reconciled);
CREATE INDEX IF NOT EXISTS idx_bar_orders_reconciled ON bar_orders(reconciled);
