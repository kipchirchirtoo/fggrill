-- Migration: 20260904_staff_credit_bills_items.sql
-- Purpose: Add items, items_snapshot, and metadata columns to staff_credit_bills for detailed line-item tracking (e.g. kitchen variance breakdown)

ALTER TABLE IF EXISTS staff_credit_bills
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS items_snapshot JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN staff_credit_bills.items IS 'Itemized line items or variance breakdown with names, quantities, unit prices, and totals';
COMMENT ON COLUMN staff_credit_bills.items_snapshot IS 'Immutable snapshot of items at time of credit bill creation';
COMMENT ON COLUMN staff_credit_bills.metadata IS 'Additional context such as shift information, kitchen variance details, or source reference';
