-- Add missing columns to inventory_movements so the foundation service
-- (inventory-foundation.service.ts) can record movement audit trails.
-- The base schema (0001_clean_core_schema) was created with different column
-- names; these ADD COLUMN IF NOT EXISTS calls are safe to re-run.

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS document_reference TEXT,
  ADD COLUMN IF NOT EXISTS reverses_movement_id UUID REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_balance_before NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS source_balance_after NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS destination_balance_before NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS destination_balance_after NUMERIC(14,3);

-- Allow document_number to be nullable (old schema had NOT NULL, new code may pass null)
ALTER TABLE public.inventory_movements
  ALTER COLUMN document_number DROP NOT NULL;
