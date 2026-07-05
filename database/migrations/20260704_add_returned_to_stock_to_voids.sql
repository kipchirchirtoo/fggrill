-- ADD RETURNED_TO_STOCK TO VOID TABLES
-- Created: 2026-07-04

ALTER TABLE public.pos_void_requests ADD COLUMN IF NOT EXISTS returned_to_stock BOOLEAN DEFAULT TRUE;
ALTER TABLE public.pos_item_void_requests ADD COLUMN IF NOT EXISTS returned_to_stock BOOLEAN DEFAULT TRUE;
ALTER TABLE public.pos_item_void_log ADD COLUMN IF NOT EXISTS returned_to_stock BOOLEAN DEFAULT TRUE;
