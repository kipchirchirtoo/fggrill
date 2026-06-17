-- Fix pos_shift_orders kitchen_status check constraint
-- Ensures 'preparing' and KDS void flow statuses are accepted

ALTER TABLE IF EXISTS public.pos_shift_orders
  DROP CONSTRAINT IF EXISTS pos_shift_orders_kitchen_status_check;

ALTER TABLE IF EXISTS public.pos_shift_orders
  ADD CONSTRAINT pos_shift_orders_kitchen_status_check
  CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'served', 'cancelled', 'void_requested', 'voided'));
