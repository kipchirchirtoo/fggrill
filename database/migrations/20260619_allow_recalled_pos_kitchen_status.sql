-- POS recalled bills are intentionally marked with kitchen_status='recalled'
-- so they remain visible on the KDS with a recall badge. Ensure the
-- pos_shift_orders constraint allows that status.

ALTER TABLE IF EXISTS public.pos_shift_orders
  DROP CONSTRAINT IF EXISTS pos_shift_orders_kitchen_status_check;

ALTER TABLE IF EXISTS public.pos_shift_orders
  ADD CONSTRAINT pos_shift_orders_kitchen_status_check
  CHECK (
    kitchen_status IN (
      'pending',
      'preparing',
      'ready',
      'served',
      'recalled',
      'cancelled',
      'void_requested',
      'voided'
    )
  );
