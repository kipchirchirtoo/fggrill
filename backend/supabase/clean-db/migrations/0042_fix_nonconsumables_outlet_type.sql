-- 0042_fix_nonconsumables_outlet_type.sql
-- The Flutter POS filters for outlet_type='non_consumables'.
-- The non-consumables outlet was created with outlet_type='other'.
-- Step 1: Expand the check constraint to allow 'non_consumables'.
-- Step 2: Update the outlet record.

ALTER TABLE public.pos_outlets
  DROP CONSTRAINT IF EXISTS pos_outlets_outlet_type_check;

ALTER TABLE public.pos_outlets
  ADD CONSTRAINT pos_outlets_outlet_type_check
    CHECK (outlet_type IN (
      'restaurant', 'main_bar', 'executive_bar', 'sports_bar',
      'cashier', 'spa', 'kitchen', 'other', 'non_consumables'
    ));

UPDATE public.pos_outlets
SET outlet_type = 'non_consumables'
WHERE branch_id = 2 AND name ILIKE '%non-consumables%';
