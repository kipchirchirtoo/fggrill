-- Add cashier shift opening workflow states before any table constraints or rows use them.
-- This is intentionally separate from the column/constraint migration because PostgreSQL
-- enum values cannot be used safely in the same migration transaction that creates them.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'shift_status'
  ) THEN
    ALTER TYPE public.shift_status ADD VALUE IF NOT EXISTS 'pending_open';
    ALTER TYPE public.shift_status ADD VALUE IF NOT EXISTS 'rejected';
    ALTER TYPE public.shift_status ADD VALUE IF NOT EXISTS 'cancelled';
  END IF;
END $$;
