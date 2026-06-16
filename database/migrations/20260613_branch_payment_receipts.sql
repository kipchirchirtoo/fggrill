-- Branch supplier/outbound payment receipt archive.
-- The PDF is rendered on demand from payment + GRN/invoice data; this table
-- records the auditable receipt document event and route.

CREATE TABLE IF NOT EXISTS public.branch_payment_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL,
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  payment_number TEXT,
  supplier_name TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  receipt_url TEXT NOT NULL,
  document_status TEXT NOT NULL DEFAULT 'archived'
    CHECK (document_status IN ('archived', 'void')),
  generated_by UUID REFERENCES public.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_branch_payment_receipts_payment
  ON public.branch_payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_branch_payment_receipts_branch_date
  ON public.branch_payment_receipts(branch_id, generated_at DESC);

ALTER TABLE public.branch_payment_receipts ENABLE ROW LEVEL SECURITY;
