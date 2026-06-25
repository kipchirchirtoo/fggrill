-- =============================================================================
-- ADD KC PINEAPPLE / KC SMOOTH / KC GINGER (250ML, 350ML, 750ML)
-- AND DROSTDY HOF WHITE, DROSTDY HOF RED,
--     CELLAR CASK RED, CELLAR CASK WHITE,
--     ROBERTSON RED, ROBERTSON WHITE
-- to the central store inventory (inventory_items).
-- simple_items is a VIEW on inventory_items — insert directly into inventory_items.
--
-- SKUs are sequential from FG-428 (last used was FG-427: SUKUMA WIKI).
-- KC variants → WHISKY / bar_store (same as existing KC 250ML/350ML/750ML).
-- Wines → WINES / bar_store (same as existing wine catalog).
-- =============================================================================

BEGIN;

-- ── KC FLAVOURED VARIANTS (9 items) ─────────────────────────────────────────
-- Prices mirror existing KC range: 250ML=350, 350ML=500, 750ML=1000

INSERT INTO public.inventory_items
  (sku, item_name, description, category, unit, item_type,
   default_unit_cost, default_selling_price, reorder_level,
   is_active, store_type, metadata)
VALUES
  -- KC PINEAPPLE
  ('FG-428', 'KC PINEAPPLE 250ML', 'KC Pineapple Flavoured Spirit 250ml',
   'WHISKY', 'bottle', 'stockable',
   0, 350.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-429', 'KC PINEAPPLE 350ML', 'KC Pineapple Flavoured Spirit 350ml',
   'WHISKY', 'bottle', 'stockable',
   0, 500.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-430', 'KC PINEAPPLE 750ML', 'KC Pineapple Flavoured Spirit 750ml',
   'WHISKY', 'bottle', 'stockable',
   0, 1000.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  -- KC SMOOTH
  ('FG-431', 'KC SMOOTH 250ML', 'KC Smooth Flavoured Spirit 250ml',
   'WHISKY', 'bottle', 'stockable',
   0, 350.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-432', 'KC SMOOTH 350ML', 'KC Smooth Flavoured Spirit 350ml',
   'WHISKY', 'bottle', 'stockable',
   0, 500.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-433', 'KC SMOOTH 750ML', 'KC Smooth Flavoured Spirit 750ml',
   'WHISKY', 'bottle', 'stockable',
   0, 1000.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  -- KC GINGER
  ('FG-434', 'KC GINGER 250ML', 'KC Ginger Flavoured Spirit 250ml',
   'WHISKY', 'bottle', 'stockable',
   0, 350.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-435', 'KC GINGER 350ML', 'KC Ginger Flavoured Spirit 350ml',
   'WHISKY', 'bottle', 'stockable',
   0, 500.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-436', 'KC GINGER 750ML', 'KC Ginger Flavoured Spirit 750ml',
   'WHISKY', 'bottle', 'stockable',
   0, 1000.00, 5, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

-- ── WINES (6 items) ──────────────────────────────────────────────────────────
-- Drostdy Hof White & Red
-- Note: FG-311 (DROSDTY HOF CLARET) and FG-322 (DROSDTY HOF PREMIUM) already
--       exist. These are explicitly named WHITE and RED per user request.
-- Cellar Cask: FG-306/FG-306-2 are inactive/0-price; adding fresh active rows.
-- Robertson: FG-318 is ROBERTSON SWEET RED; adding plain RED and WHITE.

INSERT INTO public.inventory_items
  (sku, item_name, description, category, unit, item_type,
   default_unit_cost, default_selling_price, reorder_level,
   is_active, store_type, metadata)
VALUES
  -- DROSTDY HOF
  ('FG-437', 'DROSTDY HOF WHITE', 'Drostdy Hof White Wine',
   'WINES', 'bottle', 'stockable',
   0, 921.00, 3, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-438', 'DROSTDY HOF RED', 'Drostdy Hof Red Wine',
   'WINES', 'bottle', 'stockable',
   0, 921.00, 3, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  -- CELLAR CASK
  ('FG-439', 'CELLAR CASK RED', 'Cellar Cask Red Wine',
   'WINES', 'bottle', 'stockable',
   0, 1005.00, 3, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-440', 'CELLAR CASK WHITE', 'Cellar Cask White Wine',
   'WINES', 'bottle', 'stockable',
   0, 1005.00, 3, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  -- ROBERTSON
  ('FG-441', 'ROBERTSON RED', 'Robertson Red Wine',
   'WINES', 'bottle', 'stockable',
   0, 1000.00, 3, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb),

  ('FG-442', 'ROBERTSON WHITE', 'Robertson White Wine',
   'WINES', 'bottle', 'stockable',
   0, 1000.00, 3, TRUE, 'bar_store', '{"added_by":"migration_20260625"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

COMMIT;
