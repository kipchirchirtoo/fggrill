-- Migration: 20260627_make_grn_po_nullable.sql
-- Purpose: Allow Direct GRN creation without a Purchase Order
-- The goods_receipts table had purchase_order_id as NOT NULL,
-- blocking the storekeeper from posting Direct GRNs (no PO).

ALTER TABLE IF EXISTS public.goods_receipts
  ALTER COLUMN purchase_order_id DROP NOT NULL;

COMMENT ON COLUMN public.goods_receipts.purchase_order_id IS
  'Optional reference to a purchase order. NULL for direct/walk-in GRNs.';
