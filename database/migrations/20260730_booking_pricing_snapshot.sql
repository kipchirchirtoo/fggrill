-- Phase 3: let a reservation reference the Rate Plan + Meal Plan it was booked
-- on, and store an immutable PRICING SNAPSHOT so later setup changes never alter
-- an existing booking's figures.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS meal_plan_id     uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rate_plan_id     uuid REFERENCES public.rate_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meal_plan_id     uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reservations_rate_plan ON public.reservations (rate_plan_id);
CREATE INDEX IF NOT EXISTS idx_reservations_meal_plan ON public.reservations (meal_plan_id);
