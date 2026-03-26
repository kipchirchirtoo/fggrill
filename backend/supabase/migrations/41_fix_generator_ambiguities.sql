-- Fix Ambiguous Column References in Document Generators
-- Redefines functions with v_ prefix for variables and qualified column names

-- 1. Fix generate_payment_number for supplier payments
-- Note: We use DROP first to avoid any type mismatch issues if it was previously different
DROP FUNCTION IF EXISTS public.generate_payment_number();

CREATE OR REPLACE FUNCTION public.generate_payment_number()
RETURNS TEXT AS $$
DECLARE
  v_payment_date TEXT;
  v_next_seq INT;
  v_payment_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  v_payment_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day with qualified column reference
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM public.store_supplier_payments
    WHERE public.store_supplier_payments.payment_number LIKE 'PAY' || v_payment_date || '%'
  )
  SELECT next_seq INTO v_next_seq FROM seq;
  
  -- Generate unique payment number
  v_payment_number := 'PAY' || v_payment_date || LPAD(v_next_seq::TEXT, 4, '0');
  
  RETURN v_payment_number;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix generate_po_number
DROP FUNCTION IF EXISTS public.generate_po_number();

CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TEXT AS $$
DECLARE
  v_po_date TEXT;
  v_next_seq INT;
  v_po_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  v_po_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day with qualified column reference
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM public.store_purchase_orders
    WHERE public.store_purchase_orders.po_number LIKE 'PO' || v_po_date || '%'
  )
  SELECT next_seq INTO v_next_seq FROM seq;
  
  -- Generate unique PO number
  v_po_number := 'PO' || v_po_date || LPAD(v_next_seq::TEXT, 4, '0');
  
  RETURN v_po_number;
END;
$$ LANGUAGE plpgsql;

-- We SKIP generate_grn_number for now as it's used as a TRIGGER in some parts of the system
-- and has a different return type in the database.

-- 3. Fix generate_quotation_number
DROP FUNCTION IF EXISTS public.generate_quotation_number();

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  v_quote_date TEXT;
  v_next_seq INT;
  v_quotation_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  v_quote_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day with qualified column reference
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM public.store_supplier_quotations
    WHERE public.store_supplier_quotations.quotation_number LIKE 'QT' || v_quote_date || '%'
  )
  SELECT next_seq INTO v_next_seq FROM seq;
  
  -- Generate unique quotation number
  v_quotation_number := 'QT' || v_quote_date || LPAD(v_next_seq::TEXT, 4, '0');
  
  RETURN v_quotation_number;
END;
$$ LANGUAGE plpgsql;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
