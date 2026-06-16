-- ============================================================
-- 0027_fix_pos_outlet_items_unique.sql
-- The existing unique index on pos_outlet_items(outlet_id, sku)
-- is a PARTIAL index (WHERE sku IS NOT NULL).
-- Supabase upsert's ON CONFLICT (outlet_id, sku) requires a
-- full (non-partial) unique constraint — partial indexes are
-- not matched. Replace with a full unique index.
-- ============================================================

DROP INDEX IF EXISTS public.pos_outlet_items_outlet_sku_key;

CREATE UNIQUE INDEX pos_outlet_items_outlet_sku_key
  ON public.pos_outlet_items (outlet_id, sku);
