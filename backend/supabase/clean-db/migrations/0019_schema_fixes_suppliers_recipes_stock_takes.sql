-- ============================================================
-- 0019_schema_fixes_suppliers_recipes_stock_takes.sql
-- Fixes:
--   • suppliers — add extended address / banking columns
--   • recipes  — add menu_item_name column
--   • stock_takes — relax NOT NULL / CHECK constraints,
--     add auto-generated stock_take_number default,
--     add legacy alias columns used by stock-take.controller
--   • stock_take_lines — make item_id nullable, add is_manually_added
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. suppliers — add extended columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS legal_name           TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone      TEXT,
  ADD COLUMN IF NOT EXISTS website              TEXT,
  ADD COLUMN IF NOT EXISTS address_line1        TEXT,
  ADD COLUMN IF NOT EXISTS address_line2        TEXT,
  ADD COLUMN IF NOT EXISTS city                 TEXT,
  ADD COLUMN IF NOT EXISTS state                TEXT,
  ADD COLUMN IF NOT EXISTS country              TEXT DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS postal_code          TEXT,
  ADD COLUMN IF NOT EXISTS tax_id               TEXT,
  ADD COLUMN IF NOT EXISTS vat_number           TEXT,
  ADD COLUMN IF NOT EXISTS registration_number  TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms        TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS credit_limit         NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name            TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number  TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch          TEXT,
  ADD COLUMN IF NOT EXISTS lead_time_days       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_preferred         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes                TEXT;

-- Drop the restrictive status CHECK so 'blacklisted'/'pending_approval' work
DO $$
DECLARE v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.suppliers'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%'
  LIMIT 1;
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.suppliers DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. recipes — add menu_item_name
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS menu_item_name TEXT,
  ADD COLUMN IF NOT EXISTS portion_size         NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS portions_per_recipe  NUMERIC(14,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS selling_price        NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cooking_instructions TEXT,
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS branch_id_ref        INTEGER;  -- temp alias, branch_id already exists

-- Backfill menu_item_name from name for existing rows
UPDATE public.recipes SET menu_item_name = name WHERE menu_item_name IS NULL;

-- Make name nullable (code only provides menu_item_name now)
ALTER TABLE public.recipes ALTER COLUMN name DROP NOT NULL;

-- Trigger: keep name ↔ menu_item_name in sync
CREATE OR REPLACE FUNCTION public._sync_recipe_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.name := NEW.menu_item_name;
  END IF;
  IF NEW.menu_item_name IS NULL THEN
    NEW.menu_item_name := NEW.name;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_recipe_name ON public.recipes;
CREATE TRIGGER trg_sync_recipe_name
  BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public._sync_recipe_name();

-- ────────────────────────────────────────────────────────────
-- 3. stock_takes — relax constraints and add alias columns
-- ────────────────────────────────────────────────────────────

-- Drop the restrictive stock_take_type CHECK and NOT NULL
DO $$
DECLARE v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.stock_takes'::regclass
    AND contype = 'c'
    AND conname LIKE '%type%'
  LIMIT 1;
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stock_takes DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE public.stock_takes
  ALTER COLUMN stock_take_type DROP NOT NULL,
  ALTER COLUMN stock_take_number DROP NOT NULL;

-- Drop the status CHECK so controllers can use their own values
DO $$
DECLARE v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.stock_takes'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%'
  LIMIT 1;
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stock_takes DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

-- Add alias columns used by stock-take.controller.ts
ALTER TABLE public.stock_takes
  ADD COLUMN IF NOT EXISTS take_number    TEXT,
  ADD COLUMN IF NOT EXISTS take_type      TEXT,
  ADD COLUMN IF NOT EXISTS started_by     UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS started_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by   UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category_filter TEXT;

-- Auto-generate stock_take_number when not provided via trigger
CREATE OR REPLACE FUNCTION public._auto_stock_take_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  -- Fill stock_take_number from take_number or auto-generate
  IF NEW.stock_take_number IS NULL THEN
    IF NEW.take_number IS NOT NULL THEN
      NEW.stock_take_number := NEW.take_number;
    ELSE
      SELECT COALESCE(MAX(
        CASE WHEN stock_take_number ~ '^ST-[0-9]+$'
          THEN REGEXP_REPLACE(stock_take_number, '[^0-9]', '', 'g')::INT
          ELSE 0 END
      ), 0) + 1 INTO v_seq FROM public.stock_takes;
      NEW.stock_take_number := 'ST-' || LPAD(v_seq::TEXT, 6, '0');
    END IF;
  END IF;
  -- Fill stock_take_type from take_type or default
  IF NEW.stock_take_type IS NULL THEN
    NEW.stock_take_type := COALESCE(NEW.take_type, 'cycle_count');
  END IF;
  -- Sync alias columns both ways
  IF NEW.take_number IS NULL THEN NEW.take_number := NEW.stock_take_number; END IF;
  IF NEW.take_type   IS NULL THEN NEW.take_type   := NEW.stock_take_type;   END IF;
  IF NEW.started_by  IS NULL THEN NEW.started_by  := NEW.prepared_by;       END IF;
  IF NEW.started_at  IS NULL THEN NEW.started_at  := NEW.created_at;        END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_stock_take_number ON public.stock_takes;
CREATE TRIGGER trg_auto_stock_take_number
  BEFORE INSERT ON public.stock_takes
  FOR EACH ROW EXECUTE FUNCTION public._auto_stock_take_number();

-- RPC used by stock-take.controller.ts
CREATE OR REPLACE FUNCTION public.get_stock_take_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN stock_take_number ~ '^ST-[0-9]+$'
      THEN REGEXP_REPLACE(stock_take_number, '[^0-9]', '', 'g')::INT
      ELSE 0 END
  ), 0) + 1 INTO v_seq FROM public.stock_takes;
  RETURN 'ST-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. stock_take_lines — make item_id nullable, add is_manually_added
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.stock_take_lines
  ALTER COLUMN item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_manually_added BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status_flag TEXT DEFAULT 'PENDING';

-- Drop the stock_take_lines status CHECK if any (avoid constraint violations)
DO $$
DECLARE v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.stock_take_lines'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%'
  LIMIT 1;
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stock_take_lines DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

-- Create stock_take_items as alias view for the old controller
DROP VIEW IF EXISTS public.stock_take_items CASCADE;
CREATE VIEW public.stock_take_items AS
  SELECT * FROM public.stock_take_lines;
