-- Migration: Add missing approved_by/approved_at columns and align constraints/fields for stock_counts and stock_count_items
-- Created on 2026-06-26

-- 1. Add missing columns to public.stock_counts
ALTER TABLE public.stock_counts
  ADD COLUMN IF NOT EXISTS count_number TEXT,
  ADD COLUMN IF NOT EXISTS take_type TEXT NOT NULL DEFAULT 'full_count',
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_blind_count BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS target_skus TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outlet_code TEXT,
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.pos_outlet_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_system_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_physical_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_variance_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_classification TEXT DEFAULT 'small',
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Add missing columns to public.stock_count_items
ALTER TABLE public.stock_count_items
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'units',
  ADD COLUMN IF NOT EXISTS store_type TEXT,
  ADD COLUMN IF NOT EXISTS transfers_in NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfers_out NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wastage_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returns_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_percentage NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_severity TEXT DEFAULT 'small',
  ADD COLUMN IF NOT EXISTS variance_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS counted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_movement_id UUID;

-- 3. Re-align and update the CHECK constraints to include all active statuses (especially 'reviewed')
ALTER TABLE public.stock_counts DROP CONSTRAINT IF EXISTS stock_counts_status_check;
ALTER TABLE public.stock_counts ADD CONSTRAINT stock_counts_status_check
  CHECK (status IN (
    'draft',
    'started',
    'counting',
    'submitted',
    'submitted_to_accountant',
    'under_review',
    'reviewed',
    'accountant_review',
    'accountant_approved',
    'accountant_rejected',
    'auditor_review',
    'auditor_approved',
    'auditor_flagged',
    'approved',
    'posted',
    'closed',
    'rejected',
    'cancelled'
  ));

ALTER TABLE public.stock_counts DROP CONSTRAINT IF EXISTS stock_counts_workflow_status_check;
ALTER TABLE public.stock_counts ADD CONSTRAINT stock_counts_workflow_status_check
  CHECK (workflow_status IN (
    'draft',
    'started',
    'counting',
    'submitted',
    'reviewed',
    'accountant_review',
    'auditor_review',
    'approved',
    'posted',
    'closed',
    'rejected',
    'cancelled'
  ));

ALTER TABLE public.stock_counts DROP CONSTRAINT IF EXISTS stock_counts_take_type_check;
ALTER TABLE public.stock_counts ADD CONSTRAINT stock_counts_take_type_check
  CHECK (take_type IN (
    'full_count',
    'cycle_count',
    'spot_count',
    'blind_count',
    'investigation_count',
    'outlet_count',
    'daily'
  ));
