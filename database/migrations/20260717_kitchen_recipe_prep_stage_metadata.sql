ALTER TABLE public.kitchen_production_recipes
  ADD COLUMN IF NOT EXISTS prep_stage_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS prep_stage_group VARCHAR(120),
  ADD COLUMN IF NOT EXISTS prep_stage_order INTEGER;

ALTER TABLE public.kitchen_production_recipes
  DROP CONSTRAINT IF EXISTS kitchen_production_recipes_prep_stage_code_check;

ALTER TABLE public.kitchen_production_recipes
  ADD CONSTRAINT kitchen_production_recipes_prep_stage_code_check
  CHECK (
    prep_stage_code IS NULL OR
    prep_stage_code IN ('PEEL', 'CUT', 'BLANCH', 'PREP_OTHER')
  );

COMMENT ON COLUMN public.kitchen_production_recipes.prep_stage_code IS
  'Optional operational prep stage for storekeeper workflows, e.g. PEEL, CUT, BLANCH.';

COMMENT ON COLUMN public.kitchen_production_recipes.prep_stage_group IS
  'Optional family/group name used to tie related prep stages together, e.g. POTATO FLOW.';

COMMENT ON COLUMN public.kitchen_production_recipes.prep_stage_order IS
  'Optional sequence order within a prep flow.';
