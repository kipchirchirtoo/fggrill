-- Migration to add staff accountability columns to branch_spoilage_log

ALTER TABLE public.branch_spoilage_log
  ADD COLUMN IF NOT EXISTS responsible_staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS charge_to_staff BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS credit_bill_id UUID REFERENCES public.staff_credit_bills(id) ON DELETE SET NULL;
