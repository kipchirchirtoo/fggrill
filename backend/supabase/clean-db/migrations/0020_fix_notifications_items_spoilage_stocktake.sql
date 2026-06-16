-- ============================================================
-- 0020_fix_notifications_items_spoilage_stocktake.sql
-- Fixes:
--   1. notifications — add columns used by notification.service.ts
--      (user_id, role, message, type, category, priority, is_read, read …)
--   2. inventory_items / simple_items VIEW — add last_updated, barcode,
--      category_code, supplier, image_url, is_auto_sku
--   3. central_spoilage_log — add item_name, store_type, unit, unit_cost,
--      total_loss, status, approved_by … ; fix v_central_spoilage_log VIEW
--   4. central_stock_take_sessions + central_stock_take_items — create tables
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. notifications
-- ─────────────────────────────────────────────────────────────

-- Drop restrictive CHECK constraints first
DO $$ DECLARE v TEXT; BEGIN
  SELECT conname INTO v FROM pg_constraint
  WHERE conrelid='public.notifications'::regclass AND contype='c' AND conname LIKE '%severity%' LIMIT 1;
  IF v IS NOT NULL THEN EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', v); END IF;
END $$;
DO $$ DECLARE v TEXT; BEGIN
  SELECT conname INTO v FROM pg_constraint
  WHERE conrelid='public.notifications'::regclass AND contype='c' AND conname LIKE '%status%' LIMIT 1;
  IF v IS NOT NULL THEN EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', v); END IF;
END $$;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS role          TEXT,
  ADD COLUMN IF NOT EXISTS message       TEXT,
  ADD COLUMN IF NOT EXISTS type          TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS category      TEXT,
  ADD COLUMN IF NOT EXISTS priority      TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS is_read       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS department    TEXT,
  ADD COLUMN IF NOT EXISTS action_url    TEXT,
  ADD COLUMN IF NOT EXISTS metadata      JSONB,
  ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ;

-- Backfill: sync user_id ← recipient_user_id for existing rows
UPDATE public.notifications
  SET user_id = recipient_user_id
  WHERE user_id IS NULL AND recipient_user_id IS NOT NULL;

-- Trigger: keep user_id ↔ recipient_user_id, message ↔ body, is_read/read ↔ status
CREATE OR REPLACE FUNCTION public._sync_notification_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- user_id ↔ recipient_user_id
  IF NEW.user_id IS NOT NULL AND NEW.recipient_user_id IS NULL THEN
    NEW.recipient_user_id := NEW.user_id;
  ELSIF NEW.recipient_user_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id := NEW.recipient_user_id;
  END IF;
  -- message ↔ body
  IF NEW.message IS NOT NULL AND NEW.body IS NULL THEN
    NEW.body := NEW.message;
  ELSIF NEW.body IS NOT NULL AND NEW.message IS NULL THEN
    NEW.message := NEW.body;
  END IF;
  -- is_read / read ↔ status
  IF NEW.is_read IS TRUE OR NEW.read IS TRUE THEN
    NEW.is_read  := TRUE;
    NEW.read     := TRUE;
    NEW.status   := 'read';
    IF NEW.read_at IS NULL THEN NEW.read_at := NOW(); END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_notification_cols ON public.notifications;
CREATE TRIGGER trg_sync_notification_cols
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public._sync_notification_cols();

-- ─────────────────────────────────────────────────────────────
-- 2. inventory_items — add missing columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS last_updated  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS barcode       TEXT,
  ADD COLUMN IF NOT EXISTS category_code TEXT,
  ADD COLUMN IF NOT EXISTS supplier      TEXT,
  ADD COLUMN IF NOT EXISTS image_url     TEXT,
  ADD COLUMN IF NOT EXISTS is_auto_sku   BOOLEAN DEFAULT FALSE;

-- Backfill last_updated from updated_at
UPDATE public.inventory_items
  SET last_updated = updated_at
  WHERE last_updated IS NULL;

-- Trigger: keep last_updated ↔ updated_at in sync
CREATE OR REPLACE FUNCTION public._sync_item_last_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.last_updated IS NULL THEN NEW.last_updated := NOW(); END IF;
    IF NEW.updated_at   IS NULL THEN NEW.updated_at   := NOW(); END IF;
    RETURN NEW;
  END IF;
  -- UPDATE path
  IF NEW.last_updated IS DISTINCT FROM OLD.last_updated THEN
    NEW.updated_at := NEW.last_updated;
  ELSIF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    NEW.last_updated := NEW.updated_at;
  ELSE
    -- nothing changed explicitly — stamp both
    NEW.last_updated := NOW();
    NEW.updated_at   := NOW();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_item_last_updated ON public.inventory_items;
CREATE TRIGGER trg_sync_item_last_updated
  BEFORE INSERT OR UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public._sync_item_last_updated();

-- Rebuild simple_items VIEW to expose all columns the controllers need
DROP VIEW IF EXISTS public.simple_items;
CREATE VIEW public.simple_items AS
SELECT
  id,
  sku,
  sku               AS item_sku,
  item_name,
  description,
  category,
  category_code,
  unit              AS unit_of_measure,
  unit,
  default_unit_cost AS cost_price,
  default_selling_price AS retail_price,
  reorder_level,
  is_active,
  store_type,
  branch_id,
  barcode,
  supplier,
  image_url,
  is_auto_sku,
  metadata,
  created_at,
  updated_at,
  quantity,
  last_updated
FROM public.inventory_items;

-- ─────────────────────────────────────────────────────────────
-- 3. central_spoilage_log — add missing columns
-- ─────────────────────────────────────────────────────────────

-- Drop restrictive status CHECK if any
DO $$ DECLARE v TEXT; BEGIN
  SELECT conname INTO v FROM pg_constraint
  WHERE conrelid='public.central_spoilage_log'::regclass AND contype='c' AND conname LIKE '%status%' LIMIT 1;
  IF v IS NOT NULL THEN EXECUTE format('ALTER TABLE public.central_spoilage_log DROP CONSTRAINT %I', v); END IF;
END $$;

ALTER TABLE public.central_spoilage_log
  ADD COLUMN IF NOT EXISTS item_name        TEXT,
  ADD COLUMN IF NOT EXISTS store_type       TEXT DEFAULT 'foodstuffs',
  ADD COLUMN IF NOT EXISTS category         TEXT,
  ADD COLUMN IF NOT EXISTS unit             TEXT DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS unit_cost        NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_loss       NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_value      NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reason_details   TEXT,
  ADD COLUMN IF NOT EXISTS disposal_method  TEXT,
  ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS reported_by      UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_updated     TIMESTAMPTZ DEFAULT NOW();

-- Backfill total_loss / total_value for existing rows
UPDATE public.central_spoilage_log
  SET
    total_loss  = COALESCE(quantity, 0) * COALESCE(unit_cost, 0),
    total_value = COALESCE(quantity, 0) * COALESCE(unit_cost, 0),
    reported_by = COALESCE(reported_by, recorded_by)
  WHERE total_loss = 0;

-- Trigger: auto-compute total_loss / total_value on insert/update
CREATE OR REPLACE FUNCTION public._compute_spoilage_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_loss  := COALESCE(NEW.quantity, 0) * COALESCE(NEW.unit_cost, 0);
  NEW.total_value := NEW.total_loss;
  IF NEW.reported_by IS NULL THEN NEW.reported_by := NEW.recorded_by; END IF;
  NEW.last_updated := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_compute_spoilage_totals ON public.central_spoilage_log;
CREATE TRIGGER trg_compute_spoilage_totals
  BEFORE INSERT OR UPDATE ON public.central_spoilage_log
  FOR EACH ROW EXECUTE FUNCTION public._compute_spoilage_totals();

-- Rebuild v_central_spoilage_log VIEW with all columns the controller needs
DROP VIEW IF EXISTS public.v_central_spoilage_log;
CREATE VIEW public.v_central_spoilage_log AS
SELECT
  csl.id,
  csl.branch_id,
  csl.spoilage_number,
  csl.item_sku,
  csl.item_name,
  csl.store_type,
  csl.category,
  csl.quantity,
  csl.unit,
  csl.unit_cost,
  csl.total_loss,
  csl.total_value,
  csl.reason,
  csl.reason_details,
  csl.disposal_method,
  csl.status,
  csl.notes,
  csl.spoilage_date,
  csl.recorded_by,
  csl.reported_by,
  csl.approved_by,
  csl.approved_at,
  csl.rejection_reason,
  csl.last_updated,
  csl.created_at,
  u.display_name AS reported_by_name,
  b.name       AS branch_name
FROM public.central_spoilage_log csl
LEFT JOIN public.users   u ON u.id = csl.recorded_by
LEFT JOIN public.branches b ON b.id = csl.branch_id;

-- ─────────────────────────────────────────────────────────────
-- 4. central_stock_take_sessions + central_stock_take_items
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.central_stock_take_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number       TEXT UNIQUE NOT NULL,
  store_type           TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'in_progress',
  notes                TEXT,
  started_by           UUID REFERENCES public.users(id),
  started_at           TIMESTAMPTZ DEFAULT NOW(),
  total_items_counted  INTEGER DEFAULT 0,
  items_with_variance  INTEGER DEFAULT 0,
  total_variance_value NUMERIC(14,4) DEFAULT 0,
  submitted_at         TIMESTAMPTZ,
  submitted_by         UUID REFERENCES public.users(id),
  approved_at          TIMESTAMPTZ,
  approved_by          UUID REFERENCES public.users(id),
  rejected_at          TIMESTAMPTZ,
  rejected_by          UUID REFERENCES public.users(id),
  rejection_reason     TEXT,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.central_stock_take_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.central_stock_take_sessions(id) ON DELETE CASCADE,
  item_sku         TEXT NOT NULL,
  system_quantity  NUMERIC(14,3) NOT NULL DEFAULT 0,
  counted_quantity NUMERIC(14,3),
  variance         NUMERIC(14,3),
  variance_value   NUMERIC(14,4),
  variance_reason  TEXT,
  notes            TEXT,
  unit_cost        NUMERIC(14,4) DEFAULT 0,
  counted_by       UUID REFERENCES public.users(id),
  counted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cst_items_session
  ON public.central_stock_take_items(session_id);

-- Auto-compute variance / variance_value on insert/update of items
CREATE OR REPLACE FUNCTION public._compute_cst_item_variance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.counted_quantity IS NOT NULL THEN
    NEW.variance       := NEW.counted_quantity - COALESCE(NEW.system_quantity, 0);
    NEW.variance_value := NEW.variance * COALESCE(NEW.unit_cost, 0);
  ELSE
    NEW.variance       := NULL;
    NEW.variance_value := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_compute_cst_item_variance ON public.central_stock_take_items;
CREATE TRIGGER trg_compute_cst_item_variance
  BEFORE INSERT OR UPDATE ON public.central_stock_take_items
  FOR EACH ROW EXECUTE FUNCTION public._compute_cst_item_variance();
