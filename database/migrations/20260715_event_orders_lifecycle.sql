ALTER TABLE public.event_orders
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_orders_status_check'
      AND conrelid = 'public.event_orders'::regclass
  ) THEN
    ALTER TABLE public.event_orders
      ADD CONSTRAINT event_orders_status_check
      CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));
  END IF;
END $$;

UPDATE public.event_orders
SET status = COALESCE(NULLIF(status, ''), 'open')
WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_event_orders_branch_status_date
  ON public.event_orders(branch_id, status, event_date DESC);
