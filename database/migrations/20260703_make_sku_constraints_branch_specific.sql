-- Database Migration: Make SKU constraints branch-specific
-- Description: Drop global unique constraints on item SKUs and replace them with composite constraints including branch_id.

-- 1. Alter restaurant_menu_items unique index to be branch-specific
DROP INDEX IF EXISTS public.uq_menu_items_sku;
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_items_sku_branch ON public.restaurant_menu_items (sku, branch_id);

-- 2. Alter bar_drinks unique index to be branch-specific
DROP INDEX IF EXISTS public.uq_bar_drinks_sku;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_drinks_sku_branch ON public.bar_drinks (sku, branch_id);

-- 3. Alter inventory_items unique index to be branch-specific
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_sku_key;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_sku_branch_key UNIQUE (sku, branch_id);
