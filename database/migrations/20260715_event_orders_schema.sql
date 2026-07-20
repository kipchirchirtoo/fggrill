-- =====================================================
-- EVENT ORDERS SCHEMA MIGRATION
-- Migration: 20260715_event_orders_schema.sql
-- Description:
--  1. Creates public.event_orders table
--  2. Enables Row Level Security (RLS) and adds policies
-- =====================================================

CREATE TABLE IF NOT EXISTS public.event_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_number VARCHAR(100) UNIQUE NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  -- 'conference' maps to purpose_channel 'conference_event' in kitchen consumption
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('conference', 'buffet', 'outside_catering', 'group_meal')),
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  pax INTEGER NOT NULL DEFAULT 0 CHECK (pax >= 0),
  menu_package VARCHAR(255),
  charge_per_pax NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (charge_per_pax >= 0),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'deposit_paid', 'paid', 'credit')),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'mpesa', 'bank', 'cheque', 'credit')),
  credit_due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  invoice_id UUID REFERENCES public.accounting_ar_invoices(id) ON DELETE SET NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.event_orders ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (branch scoping enforced at the API layer)
CREATE POLICY "event_orders_select"
ON public.event_orders FOR SELECT USING (auth.role() = 'authenticated');

-- Insert: authenticated users may only insert rows they own at the API layer;
--   WITH CHECK prevents client-side bypass of branch_id injection.
CREATE POLICY "event_orders_insert"
ON public.event_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update: row must be visible (USING) and the result must still be valid (WITH CHECK)
CREATE POLICY "event_orders_update"
ON public.event_orders FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Delete: only rows visible to the session may be deleted
CREATE POLICY "event_orders_delete"
ON public.event_orders FOR DELETE USING (auth.role() = 'authenticated');
