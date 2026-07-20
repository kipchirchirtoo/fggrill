ALTER TABLE public.kitchen_production_recipes
  DROP CONSTRAINT IF EXISTS kitchen_production_recipes_prep_stage_code_check;

ALTER TABLE public.kitchen_production_recipes
  ADD CONSTRAINT kitchen_production_recipes_prep_stage_code_check
  CHECK (
    prep_stage_code IS NULL OR
    prep_stage_code IN ('PEEL', 'CUT', 'PREP_OTHER')
  );

COMMENT ON COLUMN public.kitchen_production_recipes.prep_stage_code IS
  'Optional operational prep stage for storekeeper workflows, e.g. PEEL, CUT, PREP_OTHER.';
