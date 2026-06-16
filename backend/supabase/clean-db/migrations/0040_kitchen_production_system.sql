-- ============================================================
-- 0040_kitchen_production_system.sql
-- 1. Add missing menu items for branch 2
-- 2. Add SUKUMA WIKI to inventory
-- 3. Create kitchen production session tables
-- Idempotent: safe to re-run.
-- ============================================================

-- ── 1. Add missing restaurant menu items for branch 2 ────────
-- Uses "Specials" category (b7448d6d) and "Fast Foods" (5db665ac)
DO $$
DECLARE
  v_specials UUID;
  v_fastfoods UUID;
BEGIN
  SELECT id INTO v_specials  FROM public.restaurant_menu_categories WHERE branch_id=2 AND name='Specials'   LIMIT 1;
  SELECT id INTO v_fastfoods FROM public.restaurant_menu_categories WHERE branch_id=2 AND name='Fast Foods' LIMIT 1;

  INSERT INTO public.restaurant_menu_items
    (branch_id, category_id, name, unit, selling_price, cost_price, is_available, is_active, menu_type)
  VALUES
    (2, v_specials,  'Ugali',          'portion', 0, 0, true, true, 'menu'),
    (2, v_specials,  'Special Managu', 'portion', 0, 0, true, true, 'menu'),
    (2, v_specials,  'Special Sukuma', 'portion', 0, 0, true, true, 'menu'),
    (2, v_specials,  'Special Pilau',  'portion', 0, 0, true, true, 'menu'),
    (2, v_fastfoods, 'Bhajia',         'portion', 0, 0, true, true, 'menu')
  ON CONFLICT DO NOTHING;
END $$;

-- ── 2. Add SUKUMA WIKI to inventory ─────────────────────────
INSERT INTO public.inventory_items
  (sku, item_name, description, category, store_type, default_unit_cost, unit, quantity, is_active)
VALUES
  ('427', 'SUKUMA WIKI', 'Sukuma Wiki (Kale)', 'VEGETABLES', 'foodstuffs', 0, 'kg', 0, true)
ON CONFLICT (sku) DO UPDATE SET item_name=EXCLUDED.item_name, is_active=true, last_updated=NOW();

-- Register SUKUMA WIKI in branch_stock for branch 2
INSERT INTO public.branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, updated_at)
VALUES (2, '427', 0, 5, 50, NOW())
ON CONFLICT (branch_id, item_sku) DO NOTHING;

-- ── 3. Kitchen production session tables ─────────────────────

-- Session: storekeeper creates when cook comes for stock
CREATE TABLE IF NOT EXISTS public.kitchen_production_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  session_number  TEXT UNIQUE,          -- auto-generated KPS-{branch}-{YYYYMMDD}-{seq}
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  staff_id        UUID REFERENCES public.users(id),
  staff_name      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'in_production'
    CHECK (status IN ('in_production', 'completed', 'closed')),
  notes           TEXT,
  total_expected  NUMERIC(14,4) DEFAULT 0,
  total_actual    NUMERIC(14,4) DEFAULT 0,
  total_variance  NUMERIC(14,4) DEFAULT 0,
  total_penalty   NUMERIC(14,2) DEFAULT 0,
  created_by      UUID REFERENCES public.users(id),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ingredients issued to kitchen for this session
CREATE TABLE IF NOT EXISTS public.kitchen_session_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.kitchen_production_sessions(id) ON DELETE CASCADE,
  item_sku        TEXT NOT NULL,
  item_name       TEXT NOT NULL,
  quantity_issued NUMERIC(14,4) NOT NULL CHECK (quantity_issued > 0),
  unit            TEXT DEFAULT 'kg',
  unit_cost       NUMERIC(14,4) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Actual production entered when cook returns
CREATE TABLE IF NOT EXISTS public.kitchen_production_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES public.kitchen_production_sessions(id) ON DELETE CASCADE,
  menu_item_id            UUID REFERENCES public.restaurant_menu_items(id),
  menu_item_name          TEXT NOT NULL,
  expected_quantity       NUMERIC(14,4) DEFAULT 0,  -- calculated from recipe
  actual_quantity         NUMERIC(14,4) NOT NULL DEFAULT 0,
  variance                NUMERIC(14,4) DEFAULT 0,  -- actual - expected (negative = bad)
  menu_selling_price      NUMERIC(14,2) DEFAULT 0,
  variance_penalty        NUMERIC(14,2) DEFAULT 0,  -- |neg variance| × selling price
  penalty_credit_bill_id  UUID REFERENCES public.credit_bills(id),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kps_branch_date  ON public.kitchen_production_sessions (branch_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_kps_status       ON public.kitchen_production_sessions (status);
CREATE INDEX IF NOT EXISTS idx_ksi_session      ON public.kitchen_session_issues (session_id);
CREATE INDEX IF NOT EXISTS idx_kpe_session      ON public.kitchen_production_entries (session_id);
