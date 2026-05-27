-- Allow branch store stock takes to count branch_stock/simple_items rows.
-- Older stock_count_items rows were tied only to store_items.item_id, but
-- branch store inventory is keyed by item_sku from simple_items.

DO $$
BEGIN
  IF to_regclass('public.stock_count_items') IS NOT NULL THEN
    ALTER TABLE public.stock_count_items
      ADD COLUMN IF NOT EXISTS item_sku TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stock_count_items'
        AND column_name = 'item_id'
    ) THEN
      ALTER TABLE public.stock_count_items
        ALTER COLUMN item_id DROP NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stock_count_items'
        AND column_name = 'physical_quantity'
    ) THEN
      ALTER TABLE public.stock_count_items
        ALTER COLUMN physical_quantity DROP NOT NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_stock_count_items_item_sku
      ON public.stock_count_items(item_sku);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_count_items_count_sku_unique
      ON public.stock_count_items(stock_count_id, item_sku)
      WHERE item_sku IS NOT NULL;
  END IF;
END $$;
