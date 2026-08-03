ALTER TABLE IF EXISTS public.store_stocktake_records
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS posting_status TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_of_document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issuance NUMERIC(14,3) DEFAULT 0;

ALTER TABLE IF EXISTS public.bar_stocktake_records
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS posting_status TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_of_document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issuance NUMERIC(14,3) DEFAULT 0;

ALTER TABLE IF EXISTS public.kitchen_stocktake_shifts
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS posting_status TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_of_document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_stocktake_records_document
  ON public.store_stocktake_records(document_id);

CREATE INDEX IF NOT EXISTS idx_bar_stocktake_records_document
  ON public.bar_stocktake_records(document_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_stocktake_shifts_document
  ON public.kitchen_stocktake_shifts(document_id);
