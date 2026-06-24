-- Migration: Link all stocktake-related item catalogs to a single inventory_items row.
-- This removes the name-based / generated-SKU bridges and makes bar, kitchen,
-- pastry, and POS item tables talk to the same inventory item registry.

BEGIN;

-- 1. restaurant_bar_inventory: link to inventory_items and keep a stable SKU
ALTER TABLE public.restaurant_bar_inventory
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id),
  ADD COLUMN IF NOT EXISTS sku TEXT;

-- Backfill inventory_items rows for existing bar inventory items and link them.
-- The generated SKU is unique per row because it includes the row UUID.
INSERT INTO public.inventory_items (
  branch_id, sku, item_name, unit, category, item_type, is_active,
  default_unit_cost, default_selling_price
)
SELECT DISTINCT ON (('BARINV-' || r.id::text))
  r.branch_id,
  ('BARINV-' || r.id::text),
  r.item_name,
  COALESCE(r.unit, 'bottle'),
  'BAR DRINKS',
  'stockable',
  true,
  0,
  0
FROM public.restaurant_bar_inventory r
WHERE r.inventory_item_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_items i WHERE i.sku = ('BARINV-' || r.id::text)
  )
ORDER BY ('BARINV-' || r.id::text);

UPDATE public.restaurant_bar_inventory r
SET inventory_item_id = i.id,
    sku = ('BARINV-' || r.id::text)
FROM public.inventory_items i
WHERE r.inventory_item_id IS NULL
  AND i.sku = ('BARINV-' || r.id::text);

-- 2. bar_drinks: link to inventory_items and keep a stable SKU.
-- Use the existing sku when present; otherwise generate a unique one.
ALTER TABLE public.bar_drinks
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id),
  ADD COLUMN IF NOT EXISTS sku TEXT;

INSERT INTO public.inventory_items (
  branch_id, sku, item_name, unit, category, item_type, is_active,
  default_unit_cost, default_selling_price
)
SELECT DISTINCT ON (COALESCE(b.sku, ('BARD-' || b.id::text)))
  b.branch_id,
  COALESCE(b.sku, ('BARD-' || b.id::text)),
  b.name,
  COALESCE(b.unit, 'bottle'),
  'BAR DRINKS',
  'stockable',
  true,
  COALESCE(b.cost_price, 0),
  COALESCE(b.selling_price, 0)
FROM public.bar_drinks b
WHERE b.inventory_item_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_items i
    WHERE i.sku = COALESCE(b.sku, ('BARD-' || b.id::text))
  )
ORDER BY COALESCE(b.sku, ('BARD-' || b.id::text));

UPDATE public.bar_drinks b
SET inventory_item_id = i.id,
    sku = COALESCE(b.sku, ('BARD-' || b.id::text))
FROM public.inventory_items i
WHERE b.inventory_item_id IS NULL
  AND i.sku = COALESCE(b.sku, ('BARD-' || b.id::text));

-- 3. restaurant_menu_items: link to inventory_items so kitchen production maps cleanly
ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id),
  ADD COLUMN IF NOT EXISTS sku TEXT;

INSERT INTO public.inventory_items (
  branch_id, sku, item_name, unit, category, item_type, is_active,
  default_unit_cost, default_selling_price
)
SELECT DISTINCT ON (COALESCE(m.sku, ('MENU-' || m.id::text)))
  m.branch_id,
  COALESCE(m.sku, ('MENU-' || m.id::text)),
  m.name,
  COALESCE(m.unit, 'portion'),
  'KITCHEN MENU',
  'stockable',
  true,
  COALESCE(m.cost_price, 0),
  COALESCE(m.selling_price, 0)
FROM public.restaurant_menu_items m
WHERE m.inventory_item_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_items i
    WHERE i.sku = COALESCE(m.sku, ('MENU-' || m.id::text))
  )
ORDER BY COALESCE(m.sku, ('MENU-' || m.id::text));

UPDATE public.restaurant_menu_items m
SET inventory_item_id = i.id,
    sku = COALESCE(m.sku, ('MENU-' || m.id::text))
FROM public.inventory_items i
WHERE m.inventory_item_id IS NULL
  AND i.sku = COALESCE(m.sku, ('MENU-' || m.id::text));

-- 4. kitchen_production_entries: link to inventory_items via the menu item
ALTER TABLE public.kitchen_production_entries
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id);

UPDATE public.kitchen_production_entries e
SET inventory_item_id = m.inventory_item_id
FROM public.restaurant_menu_items m
WHERE e.inventory_item_id IS NULL
  AND e.menu_item_id = m.id
  AND m.inventory_item_id IS NOT NULL;

-- 5. kitchen_stocktake_items: link to inventory_items by matching the item name
ALTER TABLE public.kitchen_stocktake_items
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id);

UPDATE public.kitchen_stocktake_items s
SET inventory_item_id = i.id
FROM public.inventory_items i
WHERE s.inventory_item_id IS NULL
  AND LOWER(TRIM(i.item_name)) = LOWER(TRIM(s.item_name))
  AND i.category = 'KITCHEN MENU';

-- Also match any kitchen item that was created by the menu backfill
UPDATE public.kitchen_stocktake_items s
SET inventory_item_id = i.id
FROM public.inventory_items i
WHERE s.inventory_item_id IS NULL
  AND LOWER(TRIM(i.item_name)) = LOWER(TRIM(s.item_name));

-- 6. pastry_production_log already uses item_id as inventory_items.id; ensure the FK exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pastry_production_log_item_id_fkey'
      AND table_name = 'pastry_production_log'
  ) THEN
    ALTER TABLE public.pastry_production_log
      ADD CONSTRAINT pastry_production_log_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);
  END IF;
END $$;

-- 7. Indexes to make the new lookups fast
CREATE INDEX IF NOT EXISTS idx_restaurant_bar_inventory_inventory_item_id ON public.restaurant_bar_inventory(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_bar_drinks_inventory_item_id ON public.bar_drinks(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_inventory_item_id ON public.restaurant_menu_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_production_entries_inventory_item_id ON public.kitchen_production_entries(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_stocktake_items_inventory_item_id ON public.kitchen_stocktake_items(inventory_item_id);

COMMIT;
