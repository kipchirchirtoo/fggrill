ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS original_check_out_date date,
  ADD COLUMN IF NOT EXISTS auto_extended_nights integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_auto_extension_at timestamptz;

UPDATE public.reservations
SET original_check_out_date = check_out_date
WHERE original_check_out_date IS NULL
  AND check_out_date IS NOT NULL;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_auto_extended_nights_nonnegative;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_auto_extended_nights_nonnegative
  CHECK (auto_extended_nights >= 0);

CREATE INDEX IF NOT EXISTS idx_reservations_checked_in_checkout
  ON public.reservations (status, check_out_date);
