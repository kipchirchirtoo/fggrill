-- Migration to automatically reset original_bill_printed_at when order items or total_amount changes.
-- Date: 2026-06-26

CREATE OR REPLACE FUNCTION public.reset_original_bill_printed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If items or total_amount changes, reset original_bill_printed_at to NULL
  -- and reset reprint count to 0 (allow new clean print)
  IF (OLD.items IS DISTINCT FROM NEW.items) OR (OLD.total_amount IS DISTINCT FROM NEW.total_amount) THEN
    NEW.original_bill_printed_at = NULL;
    NEW.bill_reprint_count = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_original_bill_printed_at ON public.pos_shift_orders;

CREATE TRIGGER trg_reset_original_bill_printed_at
  BEFORE UPDATE ON public.pos_shift_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_original_bill_printed_at();
