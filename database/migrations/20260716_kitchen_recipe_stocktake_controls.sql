ALTER TABLE public.kitchen_production_recipes
  ADD COLUMN IF NOT EXISTS stocktake_control_mode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS stocktake_location VARCHAR(20);

UPDATE public.kitchen_production_recipes
SET stocktake_control_mode = CASE
    WHEN yield_type_code = 'DIRECT' THEN 'PRODUCED_ONLY'
    WHEN yield_type_code = 'SUB_ASSEMBLY' THEN 'PRODUCED_ONLY'
    WHEN yield_type_code = 'PRODUCTION' THEN 'RAW_ONLY'
    WHEN yield_type_code = 'COMPLEX' THEN 'BOTH'
    ELSE 'BOTH'
  END
WHERE stocktake_control_mode IS NULL;

UPDATE public.kitchen_production_recipes
SET stocktake_location = 'KITCHEN'
WHERE stocktake_location IS NULL;

ALTER TABLE public.kitchen_production_recipes
  ALTER COLUMN stocktake_control_mode SET DEFAULT 'BOTH',
  ALTER COLUMN stocktake_control_mode SET NOT NULL,
  ALTER COLUMN stocktake_location SET DEFAULT 'KITCHEN',
  ALTER COLUMN stocktake_location SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kitchen_production_recipes_stocktake_control_mode_check'
  ) THEN
    ALTER TABLE public.kitchen_production_recipes
      ADD CONSTRAINT kitchen_production_recipes_stocktake_control_mode_check
      CHECK (stocktake_control_mode IN ('RAW_ONLY', 'PRODUCED_ONLY', 'BOTH', 'NONE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kitchen_production_recipes_stocktake_location_check'
  ) THEN
    ALTER TABLE public.kitchen_production_recipes
      ADD CONSTRAINT kitchen_production_recipes_stocktake_location_check
      CHECK (stocktake_location IN ('KITCHEN', 'STORE', 'BOTH', 'NONE'));
  END IF;
END $$;

COMMENT ON COLUMN public.kitchen_production_recipes.stocktake_control_mode IS
  'Controls which side of a recipe is physically countable: RAW_ONLY, PRODUCED_ONLY, BOTH, or NONE.';

COMMENT ON COLUMN public.kitchen_production_recipes.stocktake_location IS
  'Controls where the recipe participates in stocktake: KITCHEN, STORE, BOTH, or NONE.';
