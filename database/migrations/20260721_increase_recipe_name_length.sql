-- Increase recipe_name length on kitchen_production_recipes to allow long concatenated recipe names
ALTER TABLE public.kitchen_production_recipes 
  ALTER COLUMN recipe_name TYPE VARCHAR(512);
