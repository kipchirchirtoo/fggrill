-- Add missing columns to conference_hall_bookings
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS customer_email TEXT;
