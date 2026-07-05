-- Fix: add columns to inventory_items that the Central Store Add/Edit flow requires.
-- The simple_items VIEW selects these columns — adding them to the underlying table
-- is enough; no view recreation needed.
-- All ADD COLUMN statements use IF NOT EXISTS so this script is safe to re-run.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS store_type          TEXT          DEFAULT 'foodstuffs',
  ADD COLUMN IF NOT EXISTS quantity            NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_id           INTEGER       REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_updated        TIMESTAMPTZ   DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS barcode             TEXT,
  ADD COLUMN IF NOT EXISTS category_code       TEXT,
  ADD COLUMN IF NOT EXISTS supplier            TEXT,
  ADD COLUMN IF NOT EXISTS image_url           TEXT,
  ADD COLUMN IF NOT EXISTS is_auto_sku         BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reorder_description TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_items_store_type
  ON public.inventory_items(store_type);

CREATE INDEX IF NOT EXISTS idx_inventory_items_branch
  ON public.inventory_items(branch_id);

-- Ensure stock_history table exists (audit log for stock movements).
-- Referenced by items.controller.ts but absent from clean-db migrations.
CREATE TABLE IF NOT EXISTS public.stock_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_sku          TEXT,
  change_type       TEXT          NOT NULL,
  quantity_change   NUMERIC(14,3) NOT NULL,
  previous_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  new_quantity      NUMERIC(14,3) NOT NULL DEFAULT 0,
  reason            TEXT,
  reference         TEXT,
  notes             TEXT,
  user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_sku
  ON public.stock_history(item_sku);
CREATE INDEX IF NOT EXISTS idx_stock_history_created
  ON public.stock_history(created_at DESC);
