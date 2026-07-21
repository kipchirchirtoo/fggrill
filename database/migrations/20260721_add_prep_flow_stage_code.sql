-- Add PREP_FLOW to kitchen_production_recipes prep_stage_code check constraint
ALTER TABLE public.kitchen_production_recipes
  DROP CONSTRAINT IF EXISTS kitchen_production_recipes_prep_stage_code_check;

ALTER TABLE public.kitchen_production_recipes
  ADD CONSTRAINT kitchen_production_recipes_prep_stage_code_check
  CHECK (
    prep_stage_code IS NULL OR
    prep_stage_code IN ('PEEL', 'CUT', 'PREP_OTHER', 'PREP_FLOW')
  );
