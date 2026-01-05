-- Add 'cashier' to user_role enum
-- Note: In Postgres, you can't easily add a value to an enum inside a transaction in some versions, 
-- but Supabase/Postgres 12+ usually allows it.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cashier';
