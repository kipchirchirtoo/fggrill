DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'adjustment_status'
  ) THEN
    BEGIN
      ALTER TYPE adjustment_status ADD VALUE IF NOT EXISTS 'approved';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER TYPE adjustment_status ADD VALUE IF NOT EXISTS 'rejected';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE public.staff_payroll_adjustments
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE public.staff_payroll_adjustments
SET
  status = 'approved',
  approved_by = COALESCE(approved_by, created_by),
  approved_at = COALESCE(approved_at, updated_at, created_at, NOW())
WHERE lower(status::text) = 'pending';

CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_staff_period_status
  ON public.staff_payroll_adjustments (staff_id, month, year, status);
