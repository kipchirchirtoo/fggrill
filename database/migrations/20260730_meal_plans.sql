-- Meal Plans — the single source of truth for meal entitlement + pricing.
-- Replaces the hardcoded / free-text meal_plan strings on reservations.
-- A NULL branch_id means the plan is GLOBAL (shared across all branches);
-- a branch may define its own plans or override pricing with a branch-scoped row.

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id              integer REFERENCES public.branches(id) ON DELETE CASCADE, -- NULL = global
  code                   text NOT NULL,
  name                   text NOT NULL,
  description            text,
  includes_breakfast     boolean NOT NULL DEFAULT false,
  includes_lunch         boolean NOT NULL DEFAULT false,
  includes_dinner        boolean NOT NULL DEFAULT false,
  includes_snacks        boolean NOT NULL DEFAULT false,
  includes_drinks        boolean NOT NULL DEFAULT false,
  adult_daily_price      numeric NOT NULL DEFAULT 0 CHECK (adult_daily_price >= 0),
  child_daily_price      numeric NOT NULL DEFAULT 0 CHECK (child_daily_price >= 0),
  infant_daily_price     numeric NOT NULL DEFAULT 0 CHECK (infant_daily_price >= 0),
  included_in_room_rate  boolean NOT NULL DEFAULT true,
  is_default             boolean NOT NULL DEFAULT false,
  is_active              boolean NOT NULL DEFAULT true,
  created_by             uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by             uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Code must be unique within its scope (per branch, and once for global). The
-- COALESCE folds the global (NULL) scope to 0 so a global + a branch plan can
-- share a code, but two globals — or two plans in the same branch — cannot.
CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_code_scope_key
  ON public.meal_plans (upper(code), COALESCE(branch_id, 0));

CREATE INDEX IF NOT EXISTS idx_meal_plans_branch ON public.meal_plans (branch_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_active ON public.meal_plans (is_active);

-- Seed the five standard global meal plans (idempotent).
INSERT INTO public.meal_plans
  (branch_id, code, name, description, includes_breakfast, includes_lunch, includes_dinner, includes_snacks, includes_drinks, included_in_room_rate, is_default)
VALUES
  (NULL, 'RO', 'Room Only',        'Accommodation only — no meals included.',                 false, false, false, false, false, true,  true),
  (NULL, 'BB', 'Bed & Breakfast',  'Breakfast included in the room rate.',                     true,  false, false, false, false, true,  false),
  (NULL, 'HB', 'Half Board',       'Breakfast + dinner included.',                             true,  false, true,  false, false, true,  false),
  (NULL, 'FB', 'Full Board',       'Breakfast + lunch + dinner included.',                     true,  true,  true,  false, false, true,  false),
  (NULL, 'AI', 'All Inclusive',    'Breakfast, lunch, dinner, snacks and drinks included.',    true,  true,  true,  true,  true,  true,  false)
ON CONFLICT (upper(code), COALESCE(branch_id, 0)) DO NOTHING;
