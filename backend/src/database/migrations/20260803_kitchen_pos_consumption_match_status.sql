-- Food control: track EVERY sold POS item.
-- recordKitchenConsumption previously dropped any sold outlet item that had no
-- recipe link and no restaurant_menu_items -> inventory_item link, so those
-- sales never reached kitchen_shift_pos_consumption and Daily Controls
-- under-counted. We now record such items with match_status = 'unmatched' so
-- nothing is lost and the accountant can register them. Existing/matched rows
-- default to 'matched'.

ALTER TABLE public.kitchen_shift_pos_consumption
  ADD COLUMN IF NOT EXISTS match_status text NOT NULL DEFAULT 'matched';

CREATE INDEX IF NOT EXISTS idx_kspc_shift_match_status
  ON public.kitchen_shift_pos_consumption (shift_id, match_status);
