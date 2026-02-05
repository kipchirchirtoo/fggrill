-- Add 'morning_opening' to stock_counts count_type check constraint

DO $$
BEGIN
    -- Drop the existing constraint
    ALTER TABLE stock_counts DROP CONSTRAINT IF EXISTS stock_counts_count_type_check;

    -- Add the new constraint with 'morning_opening'
    ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_count_type_check 
    CHECK (count_type IN ('daily', 'weekly', 'monthly', 'ad-hoc', 'morning_opening'));
END $$;
