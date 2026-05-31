-- Station cashier routing for unified POS captain orders.
-- Each branch owns station outlets; cashiers can be assigned to a station and
-- cashier queues now filter by those assignments or station-specific roles.

ALTER TABLE IF EXISTS public.pos_outlets
  DROP CONSTRAINT IF EXISTS pos_outlets_outlet_type_check;

ALTER TABLE IF EXISTS public.pos_outlets
  ADD CONSTRAINT pos_outlets_outlet_type_check
  CHECK (outlet_type IN (
    'restaurant',
    'main_bar',
    'executive_bar',
    'non_consumables',
    'cashier',
    'kyogong_reception',
    'kyogong_spa',
    'kyogong_executive_bar',
    'kyogong_sports_bar'
  ));

INSERT INTO public.pos_outlets (branch_id, outlet_type, name, pin_prefix, is_active)
SELECT b.id, station.outlet_type, concat(b.name, ' ', station.display_name), station.pin_prefix, true
FROM public.branches b
CROSS JOIN (
  VALUES
    ('restaurant', 'Restaurant POS', 'R'),
    ('main_bar', 'Main Bar POS', 'M'),
    ('executive_bar', 'Executive Bar POS', 'E'),
    ('non_consumables', 'Non-consumables POS', 'N')
) AS station(outlet_type, display_name, pin_prefix)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pos_outlets po
  WHERE po.branch_id = b.id
    AND po.outlet_type = station.outlet_type
);

CREATE INDEX IF NOT EXISTS idx_pos_outlets_branch_type_active
  ON public.pos_outlets(branch_id, outlet_type, is_active);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_assignments_user_active
  ON public.pos_outlet_assignments(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_assignments_outlet_active
  ON public.pos_outlet_assignments(outlet_id, is_active);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_outlet_payment_created
  ON public.pos_shift_orders(outlet_id, payment_status, created_at DESC);

COMMENT ON TABLE public.pos_outlet_assignments IS
  'Maps cashiers and station staff to branch POS stations. Generic cashier users with assignments are restricted to those stations; station-specific cashier roles are restricted by outlet type.';
