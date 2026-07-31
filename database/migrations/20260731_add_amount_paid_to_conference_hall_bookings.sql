-- Add amount_paid column to conference_hall_bookings
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
