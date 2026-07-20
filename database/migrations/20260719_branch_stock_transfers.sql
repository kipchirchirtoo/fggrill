-- Migration to create branch stock transfers tables
CREATE TABLE IF NOT EXISTS public.branch_stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  to_branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DISPATCHED' CHECK (status IN ('DISPATCHED', 'RECEIVED', 'DISCREPANCY_FLAGGED')),
  urgency TEXT NOT NULL DEFAULT 'NORMAL' CHECK (urgency IN ('NORMAL', 'URGENT')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  transfer_number TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.branch_stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.branch_stock_transfers(id) ON DELETE CASCADE,
  item_sku TEXT NOT NULL,
  quantity_dispatched NUMERIC(12, 3) NOT NULL CHECK (quantity_dispatched > 0),
  quantity_received NUMERIC(12, 3) CHECK (quantity_received >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_branch_stock_transfers_from_branch ON public.branch_stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_transfers_to_branch ON public.branch_stock_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_transfers_status ON public.branch_stock_transfers(status);

CREATE INDEX IF NOT EXISTS idx_branch_stock_transfer_items_transfer ON public.branch_stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_transfer_items_sku ON public.branch_stock_transfer_items(item_sku);

-- Enable RLS
ALTER TABLE public.branch_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Security Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'branch_stock_transfers' AND policyname = 'branch_stock_transfers_authenticated'
  ) THEN
    CREATE POLICY branch_stock_transfers_authenticated ON public.branch_stock_transfers
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'branch_stock_transfers' AND policyname = 'branch_stock_transfers_service'
  ) THEN
    CREATE POLICY branch_stock_transfers_service ON public.branch_stock_transfers
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'branch_stock_transfer_items' AND policyname = 'branch_stock_transfer_items_authenticated'
  ) THEN
    CREATE POLICY branch_stock_transfer_items_authenticated ON public.branch_stock_transfer_items
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'branch_stock_transfer_items' AND policyname = 'branch_stock_transfer_items_service'
  ) THEN
    CREATE POLICY branch_stock_transfer_items_service ON public.branch_stock_transfer_items
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
