-- Link payments to Kyogong transactions
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS kyogong_transaction_id UUID REFERENCES shift_transactions(id);

-- Allow 'BILL' method in shift_transactions
-- First, identify the constraint name if it exists, or just drop and recreate
DO $$ 
BEGIN
    ALTER TABLE shift_transactions DROP CONSTRAINT IF EXISTS shift_transactions_payment_method_check;
    
    ALTER TABLE shift_transactions 
    ADD CONSTRAINT shift_transactions_payment_method_check 
    CHECK (payment_method IN ('CASH', 'MPESA', 'CARD', 'SPLIT', 'BILL'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update failed: %', SQLERRM;
END $$;
