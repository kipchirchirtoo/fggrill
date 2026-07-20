-- =====================================================
-- KITCHEN SHIFT CONTROL SNAPSHOTS
-- Migration: 20260719_kitchen_shift_control_snapshots.sql
-- Description:
--   Freeze one Daily Controls payload per kitchen shift so historical
--   food-control reports never drift when standards, recipes, direct-item
--   mappings, or event packages are edited later.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.kitchen_shift_control_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.kitchen_shifts(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id),
  cashier_shift_id UUID NULL REFERENCES public.cashier_shift_logs(id) ON DELETE SET NULL,
  shift_date DATE NOT NULL,
  shift_status TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_shift_control_snapshots_shift
  ON public.kitchen_shift_control_snapshots(shift_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_shift_control_snapshots_branch_date
  ON public.kitchen_shift_control_snapshots(branch_id, shift_date DESC);

ALTER TABLE public.kitchen_shift_control_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_shift_control_snapshots'
      AND policyname = 'kitchen_shift_control_snapshots_select'
  ) THEN
    CREATE POLICY "kitchen_shift_control_snapshots_select"
    ON public.kitchen_shift_control_snapshots
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_shift_control_snapshots'
      AND policyname = 'kitchen_shift_control_snapshots_modify'
  ) THEN
    CREATE POLICY "kitchen_shift_control_snapshots_modify"
    ON public.kitchen_shift_control_snapshots
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.kitchen_shift_control_snapshots IS
  'Frozen per-kitchen-shift Daily Controls payload plus the exact standards/recipe/direct-item source snapshot used to compute it.';

COMMENT ON COLUMN public.kitchen_shift_control_snapshots.snapshot_data IS
  'JSON payload containing shift_report and source_snapshot. Used as the historical source of truth for kitchen daily controls and variance review.';
