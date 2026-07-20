ALTER TABLE public.kitchen_shifts
  ADD COLUMN IF NOT EXISTS assigned_dispense_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.kitchen_shifts.assigned_dispense_ids
  IS 'Staff assigned to dispensing/service for the kitchen shift.';
