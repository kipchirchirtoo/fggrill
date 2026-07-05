-- Migration: Add explanation and action_taken columns to store_stocktake_records and bar_stocktake_records
-- Date: 2026-07-04

DO $$
BEGIN
  -- 1. Add columns to store_stocktake_records
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'store_stocktake_records'
  ) THEN
    ALTER TABLE public.store_stocktake_records ADD COLUMN IF NOT EXISTS explanation TEXT;
    ALTER TABLE public.store_stocktake_records ADD COLUMN IF NOT EXISTS action_taken TEXT;
  END IF;

  -- 2. Add columns to bar_stocktake_records
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bar_stocktake_records'
  ) THEN
    ALTER TABLE public.bar_stocktake_records ADD COLUMN IF NOT EXISTS explanation TEXT;
    ALTER TABLE public.bar_stocktake_records ADD COLUMN IF NOT EXISTS action_taken TEXT;
  END IF;
END $$;
