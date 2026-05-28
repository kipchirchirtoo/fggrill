-- Persist Kitchen Display prep state without changing cashier/payment clearing.

ALTER TABLE IF EXISTS restaurant_order_items
  ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kitchen_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kitchen_ready_by UUID;

ALTER TABLE IF EXISTS restaurant_order_items
  DROP CONSTRAINT IF EXISTS restaurant_order_items_kitchen_status_check;

ALTER TABLE IF EXISTS restaurant_order_items
  ADD CONSTRAINT restaurant_order_items_kitchen_status_check
  CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'served', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_kitchen_status
  ON restaurant_order_items(order_id, kitchen_status);

ALTER TABLE IF EXISTS pos_shift_orders
  ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kitchen_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kitchen_ready_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS pos_shift_orders
  DROP CONSTRAINT IF EXISTS pos_shift_orders_kitchen_status_check;

ALTER TABLE IF EXISTS pos_shift_orders
  ADD CONSTRAINT pos_shift_orders_kitchen_status_check
  CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'served', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_kitchen_status
  ON pos_shift_orders(shift_id, kitchen_status, payment_status);
