-- Migration: Add explanation and action_taken columns to stock take item tables
-- Date: 2026-07-04

DO $$
BEGIN
  -- 1. Add to stock_take_lines
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'stock_take_lines'
  ) THEN
    ALTER TABLE public.stock_take_lines ADD COLUMN IF NOT EXISTS explanation TEXT;
    ALTER TABLE public.stock_take_lines ADD COLUMN IF NOT EXISTS action_taken TEXT;
  END IF;

  -- 2. Add to stock_count_items
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'stock_count_items'
  ) THEN
    ALTER TABLE public.stock_count_items ADD COLUMN IF NOT EXISTS explanation TEXT;
    ALTER TABLE public.stock_count_items ADD COLUMN IF NOT EXISTS action_taken TEXT;
  END IF;

  -- 3. Add to kitchen_stocktake_items
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'kitchen_stocktake_items'
  ) THEN
    ALTER TABLE public.kitchen_stocktake_items ADD COLUMN IF NOT EXISTS explanation TEXT;
    ALTER TABLE public.kitchen_stocktake_items ADD COLUMN IF NOT EXISTS action_taken TEXT;
  END IF;
END $$;
