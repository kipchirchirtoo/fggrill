-- Migration: Shift-based master-bill settlement columns and payment stamps
-- Date: 2026-08-06

-- Shift-based master-bill settlement columns
ALTER TABLE public.pos_master_bill_settlements
  ADD COLUMN IF NOT EXISTS shift_id               uuid,
  ADD COLUMN IF NOT EXISTS responsible_cashier_id uuid,
  ADD COLUMN IF NOT EXISTS receipt_printed_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_shift
  ON public.pos_master_bill_settlements (shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_responsible
  ON public.pos_master_bill_settlements (responsible_cashier_id, status) WHERE responsible_cashier_id IS NOT NULL;

-- Externally-settled markers (this is the one that was lock-blocked)
ALTER TABLE public.pos_shift_orders
  ADD COLUMN IF NOT EXISTS externally_settled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS externally_settled_by  uuid;

-- Cash PO payment stamp
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS paid_by_cashier_id uuid,
  ADD COLUMN IF NOT EXISTS paid_shift_id      uuid,
  ADD COLUMN IF NOT EXISTS paid_at            timestamptz;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_paid_shift
  ON public.purchase_orders (paid_shift_id) WHERE paid_shift_id IS NOT NULL;

-- Make the new columns visible to the API layer
NOTIFY pgrst, 'reload schema';
