-- ============================================================
-- Migration 91: Kitchen Shift Ledger
-- Adds shift tracking, multi-staff accountability,
-- session closing-stock ledger, and spoilage enhancements.
-- ============================================================

-- ── 1. Shift type on production sessions ─────────────────────
ALTER TABLE public.kitchen_production_sessions
  ADD COLUMN IF NOT EXISTS shift_type TEXT
    CHECK (shift_type IN ('shift_a', 'shift_b'))
    DEFAULT 'shift_a';

-- ── 2. Multi-staff per session ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kitchen_session_staff (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL
    REFERENCES public.kitchen_production_sessions(id) ON DELETE CASCADE,
  staff_profile_id UUID REFERENCES public.staff_profiles(id),
  staff_name       TEXT NOT NULL,
  role             TEXT DEFAULT 'cook'
    CHECK (role IN ('cook', 'helper', 'supervisor')),
  is_accountable   BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kss_session
  ON public.kitchen_session_staff(session_id);
CREATE INDEX IF NOT EXISTS idx_kss_staff
  ON public.kitchen_session_staff(staff_profile_id);

-- ── 3. Closing-stock ledger per session ───────────────────────
CREATE TABLE IF NOT EXISTS public.kitchen_session_closing_stock (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL
    REFERENCES public.kitchen_production_sessions(id) ON DELETE CASCADE,
  item_sku         TEXT NOT NULL,
  item_name        TEXT,
  issued_quantity  NUMERIC(14,4) DEFAULT 0,
  closing_quantity NUMERIC(14,4) DEFAULT 0,
  unit             TEXT DEFAULT 'kg',
  recorded_by      UUID REFERENCES public.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kscs_session
  ON public.kitchen_session_closing_stock(session_id);

-- ── 4. Enrich kitchen_wastage ─────────────────────────────────
ALTER TABLE public.kitchen_wastage
  ADD COLUMN IF NOT EXISTS item_name  TEXT,
  ADD COLUMN IF NOT EXISTS unit_cost  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES public.kitchen_production_sessions(id),
  ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_kw_branch_date
  ON public.kitchen_wastage(branch_id, wastage_date);
CREATE INDEX IF NOT EXISTS idx_kw_session
  ON public.kitchen_wastage(session_id);
