-- Branch Storekeeper food control: kitchen_shift_pos_consumption needs to
-- identify which line item on the original bill it came from, so a single
-- voided/exchanged line item can be reversed precisely without touching the
-- other items on the same bill. Confirmed against the live DB on 2026-06-27:
-- kitchen_shift_pos_consumption has no item_index column today.
-- Additive only — safe to run on a live table with existing rows (defaults
-- to NULL on history; new inserts/reversal logic added in
-- outlet-pos.controller.ts populate it going forward).

ALTER TABLE public.kitchen_shift_pos_consumption
  ADD COLUMN IF NOT EXISTS item_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_kspc_pos_order_id
  ON public.kitchen_shift_pos_consumption(pos_order_id);
