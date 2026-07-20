BEGIN;

CREATE TABLE IF NOT EXISTS public.accommodation_breakfast_pax (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    breakfast_date DATE NOT NULL,
    calculated_pax INTEGER NOT NULL DEFAULT 0 CHECK (calculated_pax >= 0),
    confirmed_pax INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_pax >= 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'locked')),
    adjustment_reason TEXT NULL,
    source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    confirmed_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_accommodation_breakfast_pax_branch_date UNIQUE (branch_id, breakfast_date)
);

CREATE INDEX IF NOT EXISTS idx_accommodation_breakfast_pax_branch_date
    ON public.accommodation_breakfast_pax(branch_id, breakfast_date DESC);

ALTER TABLE public.accommodation_breakfast_pax ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accommodation_breakfast_pax_select ON public.accommodation_breakfast_pax;
CREATE POLICY accommodation_breakfast_pax_select
ON public.accommodation_breakfast_pax
FOR SELECT
USING (true);

DROP POLICY IF EXISTS accommodation_breakfast_pax_insert ON public.accommodation_breakfast_pax;
CREATE POLICY accommodation_breakfast_pax_insert
ON public.accommodation_breakfast_pax
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS accommodation_breakfast_pax_update ON public.accommodation_breakfast_pax;
CREATE POLICY accommodation_breakfast_pax_update
ON public.accommodation_breakfast_pax
FOR UPDATE
USING (true)
WITH CHECK (true);

COMMIT;
