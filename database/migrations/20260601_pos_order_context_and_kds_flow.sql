-- Persist POS order placement context so cashier bills and KDS do not infer it
-- from customer display text. Also allow KDS void flow statuses.

ALTER TABLE IF EXISTS public.pos_shift_orders
  ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'takeaway',
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS room_number TEXT,
  ADD COLUMN IF NOT EXISTS kitchen_served_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS captain_printed_at TIMESTAMPTZ;

UPDATE public.pos_shift_orders
SET
  order_type = 'dine_in',
  table_number = substring(customer_name from '(?i)^Table\s+(.+)$')
WHERE (order_type IS NULL OR order_type = 'takeaway')
  AND customer_name ~* '^Table\s+';

UPDATE public.pos_shift_orders
SET
  order_type = 'room_service',
  room_number = substring(customer_name from '(?i)^Room\s+(.+)$')
WHERE (order_type IS NULL OR order_type = 'takeaway')
  AND customer_name ~* '^Room\s+';

ALTER TABLE IF EXISTS public.pos_shift_orders
  DROP CONSTRAINT IF EXISTS pos_shift_orders_order_type_check;

ALTER TABLE IF EXISTS public.pos_shift_orders
  ADD CONSTRAINT pos_shift_orders_order_type_check
  CHECK (order_type IN ('dine_in', 'takeaway', 'room_service', 'bar', 'counter', 'non_consumable'));

ALTER TABLE IF EXISTS public.pos_shift_orders
  DROP CONSTRAINT IF EXISTS pos_shift_orders_kitchen_status_check;

ALTER TABLE IF EXISTS public.pos_shift_orders
  ADD CONSTRAINT pos_shift_orders_kitchen_status_check
  CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'served', 'cancelled', 'void_requested', 'voided'));

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_order_context
  ON public.pos_shift_orders(outlet_id, order_type, created_at DESC);
