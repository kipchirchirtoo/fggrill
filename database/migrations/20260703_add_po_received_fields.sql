-- Migration: Add missing received columns to purchase_orders and update store_purchase_orders view
-- Date: 2026-07-03

-- 1. Add received columns to purchase_orders table if they do not exist
ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_by_id UUID REFERENCES public.users(id);

-- 2. Drop and recreate view to include the new columns
DROP VIEW IF EXISTS public.store_purchase_orders;

CREATE OR REPLACE VIEW public.store_purchase_orders AS
 SELECT id,
    branch_id,
    po_number,
    supplier_id,
    source_module,
    status,
    finance_status,
    order_date,
    expected_delivery_date,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    created_by,
    approved_by,
    approved_at,
    metadata,
    created_at,
    updated_at,
    payment_terms,
    delivery_terms,
    special_instructions,
    sent_to_supplier,
    sent_at,
    sent_by_id,
    po_date,
    created_by_id,
    approved_by_id,
    received_at,
    received_by_id
   FROM purchase_orders;

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
