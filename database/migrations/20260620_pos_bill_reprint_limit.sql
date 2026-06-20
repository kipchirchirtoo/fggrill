-- Cap customer-bill reprints at exactly one duplicate per order state.
-- The very first bill print (on order creation, or on recall once the bill
-- has genuinely changed) is unaffected -- that's a normal system-triggered
-- print, not a reprint. This column only tracks the WAITER/CASHIER-initiated
-- "Reprint bill" action, so it can be checked-and-incremented atomically by
-- the backend before allowing the duplicate to print.
ALTER TABLE public.pos_shift_orders
  ADD COLUMN IF NOT EXISTS bill_reprint_count INTEGER NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
