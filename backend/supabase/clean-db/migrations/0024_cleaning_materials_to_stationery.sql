-- ============================================================
-- 0024_cleaning_materials_to_stationery.sql
-- Reclassify CLEANING MATERIALS from 'foodstuffs' → 'stationery'
-- so they appear on the Stationery Items screen in central store.
-- ============================================================

UPDATE public.inventory_items
  SET store_type   = 'stationery',
      last_updated = NOW()
  WHERE category = 'CLEANING MATERIALS';
