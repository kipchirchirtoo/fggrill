-- Migration to add original_bill_printed_at tracking column to pos_shift_orders
-- Date: 2026-06-26

ALTER TABLE public.pos_shift_orders
  ADD COLUMN IF NOT EXISTS original_bill_printed_at TIMESTAMPTZ DEFAULT NULL;

-- Create an index to support scanning printed states
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_original_bill_printed_at
  ON public.pos_shift_orders(original_bill_printed_at);
