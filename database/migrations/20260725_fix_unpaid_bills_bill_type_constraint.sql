-- Migration: Expand unpaid_bills bill_type check constraint to include pos_order
-- The pending-bills migration job was failing with error code 23514 because
-- 'pos_shift_orders' was not a valid bill_type. We now store 'pos_order' instead,
-- but we need the constraint to accept it.
--
-- Strategy: drop the old CHECK constraint and recreate it with the expanded list.
-- We use DO $$ EXCEPTION handling so this is idempotent (safe to run multiple times).

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the actual constraint name (it may vary across environments)
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.unpaid_bills'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%bill_type%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.unpaid_bills DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE 'Dropped old bill_type constraint: %', v_constraint_name;
  END IF;
END $$;

-- Recreate with the full valid set
ALTER TABLE public.unpaid_bills
  ADD CONSTRAINT unpaid_bills_bill_type_check
  CHECK (bill_type IN (
    'restaurant_order',
    'restaurant_orders',   -- legacy table-name values already in DB
    'bar_order',
    'bar_orders',          -- legacy
    'pos_transaction',
    'pos_transactions',    -- legacy
    'pos_order',           -- new value for pos_shift_orders
    'pos_shift_orders',    -- legacy (if any rows already stored this)
    'room_charge',
    'event',
    'other'
  ));

-- Also ensure the source_type column on pos_shift_orders allows 'pos_order'
-- (The original migration only allows manual/restaurant_order/bar_order/pos_transaction)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.pos_shift_orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%source_type%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pos_shift_orders DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE 'Dropped old pos_shift_orders source_type constraint: %', v_constraint_name;
  END IF;
END $$;

ALTER TABLE public.pos_shift_orders
  ADD CONSTRAINT pos_shift_orders_source_type_check
  CHECK (source_type IN (
    'manual',
    'restaurant_order',
    'bar_order',
    'pos_transaction',
    'pos_order',
    'split',
    'exchange'
  ));
