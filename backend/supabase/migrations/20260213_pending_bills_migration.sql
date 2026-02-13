-- Add tracking columns to restaurant_orders for pending bill migration
ALTER TABLE restaurant_orders 
ADD COLUMN IF NOT EXISTS migrated_to_credit_bill BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS credit_bill_id UUID REFERENCES staff_credit_bills(id);

-- Create void bills audit table for auditor and branch accountant review
CREATE TABLE IF NOT EXISTS void_bills_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES restaurant_orders(id) UNIQUE,
    order_number TEXT NOT NULL,
    waiter_id UUID REFERENCES staff_profiles(id),
    waiter_name TEXT,
    table_number TEXT,
    room_number TEXT,
    total_amount DECIMAL(10, 2),
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by UUID REFERENCES users(id),
    void_reason TEXT,
    reviewed_by_auditor BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    auditor_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_migration 
ON restaurant_orders(migrated_to_credit_bill, created_at) 
WHERE migrated_to_credit_bill = false;

CREATE INDEX IF NOT EXISTS idx_orders_status_created 
ON restaurant_orders(status, created_at) 
WHERE status IN ('pending', 'void');

CREATE INDEX IF NOT EXISTS idx_void_bills_reviewed 
ON void_bills_audit(reviewed_by_auditor);

CREATE INDEX IF NOT EXISTS idx_void_bills_waiter 
ON void_bills_audit(waiter_id);

-- Add comment for documentation
COMMENT ON TABLE void_bills_audit IS 'Tracks voided restaurant orders for auditor and branch accountant review';
COMMENT ON COLUMN restaurant_orders.migrated_to_credit_bill IS 'Indicates if pending order was auto-migrated to staff credit bills';
COMMENT ON COLUMN restaurant_orders.migrated_at IS 'Timestamp when order was migrated to credit bills';
COMMENT ON COLUMN restaurant_orders.credit_bill_id IS 'Reference to the created staff credit bill record';
