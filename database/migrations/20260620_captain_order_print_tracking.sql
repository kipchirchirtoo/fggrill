-- Tracks whether a captain order ticket has already been printed for an
-- order's CURRENT state (its initial creation, or its latest recall batch),
-- so KDS / cashier-station backup polling can skip a reprint instead of
-- relying on in-memory dedup that gets wiped every time the screen
-- remounts (e.g. after logging out and back in).
--
-- pos_shift_orders.captain_printed_at was already referenced by
-- recordShiftOrder() in outlet-pos.controller.ts but the column never
-- actually existed, so that update silently no-op'd. This migration adds
-- the column that code already expected, and the same concept is extended
-- to updateShiftOrder() (recall) and to the legacy restaurant_orders table.

ALTER TABLE public.pos_shift_orders
  ADD COLUMN IF NOT EXISTS captain_printed_at TIMESTAMPTZ;

ALTER TABLE public.restaurant_orders
  ADD COLUMN IF NOT EXISTS captain_printed_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
