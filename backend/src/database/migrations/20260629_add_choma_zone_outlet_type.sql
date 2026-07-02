ALTER TABLE public.pos_outlets DROP CONSTRAINT IF EXISTS pos_outlets_outlet_type_check;
ALTER TABLE public.pos_outlets ADD CONSTRAINT pos_outlets_outlet_type_check
  CHECK (outlet_type = ANY (ARRAY[
    'restaurant'::text,
    'main_bar'::text,
    'executive_bar'::text,
    'sports_bar'::text,
    'cashier'::text,
    'spa'::text,
    'kitchen'::text,
    'other'::text,
    'non_consumables'::text,
    'choma_zone'::text
  ]));
