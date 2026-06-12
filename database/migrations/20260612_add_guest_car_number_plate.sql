-- Add optional guest vehicle registration support for reception workflows.
-- New guest writes require id_number at the API/UI layer; existing legacy rows
-- may still be missing IDs, so this migration avoids unsafe fake backfills.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS car_number_plate VARCHAR(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guests_id_number_not_blank'
      AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_id_number_not_blank
      CHECK (id_number IS NULL OR length(trim(id_number)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guests_car_number_plate_not_blank'
      AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_car_number_plate_not_blank
      CHECK (car_number_plate IS NULL OR length(trim(car_number_plate)) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_guests_id_number
  ON public.guests (id_number);

CREATE INDEX IF NOT EXISTS idx_guests_car_number_plate
  ON public.guests (car_number_plate);
