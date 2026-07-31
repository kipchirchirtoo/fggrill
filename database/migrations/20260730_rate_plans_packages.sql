-- Phase 2: turn rate_plans into real sellable ROOM PACKAGES.
-- Existing columns (kept): branch_id, room_type_id, code, name, rate_per_night,
-- meal_plan (legacy text), min_stay, max_stay, valid_from, valid_to, is_active.
-- New: a proper meal_plan_id FK + extra-pax pricing + reception default flag.

ALTER TABLE public.rate_plans
  ADD COLUMN IF NOT EXISTS meal_plan_id            uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description             text,
  ADD COLUMN IF NOT EXISTS extra_adult_charge      numeric NOT NULL DEFAULT 0 CHECK (extra_adult_charge >= 0),
  ADD COLUMN IF NOT EXISTS extra_child_charge      numeric NOT NULL DEFAULT 0 CHECK (extra_child_charge >= 0),
  ADD COLUMN IF NOT EXISTS extra_bed_charge        numeric NOT NULL DEFAULT 0 CHECK (extra_bed_charge >= 0),
  ADD COLUMN IF NOT EXISTS max_occupancy           integer,
  ADD COLUMN IF NOT EXISTS is_default_for_reception boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rate_plans_room_type ON public.rate_plans (room_type_id);
CREATE INDEX IF NOT EXISTS idx_rate_plans_meal_plan ON public.rate_plans (meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_rate_plans_branch    ON public.rate_plans (branch_id);

-- Backfill meal_plan_id from the legacy meal_plan text code against the global plans.
UPDATE public.rate_plans rp
SET meal_plan_id = mp.id
FROM public.meal_plans mp
WHERE rp.meal_plan_id IS NULL
  AND mp.branch_id IS NULL
  AND (
    upper(coalesce(rp.meal_plan, '')) = upper(mp.code)
    OR lower(replace(coalesce(rp.meal_plan, ''), '_', ' ')) = lower(mp.name)
    OR (lower(coalesce(rp.meal_plan, 'room_only')) IN ('room_only', 'ro')                         AND mp.code = 'RO')
    OR (lower(coalesce(rp.meal_plan, ''))          IN ('bed_breakfast', 'bb', 'bed & breakfast')  AND mp.code = 'BB')
    OR (lower(coalesce(rp.meal_plan, ''))          IN ('half_board', 'hb')                        AND mp.code = 'HB')
    OR (lower(coalesce(rp.meal_plan, ''))          IN ('full_board', 'fb')                        AND mp.code = 'FB')
    OR (lower(coalesce(rp.meal_plan, ''))          IN ('all_inclusive', 'ai')                     AND mp.code = 'AI')
  );
