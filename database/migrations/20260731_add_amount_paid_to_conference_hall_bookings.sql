-- Fix schema columns and nullability for conference_hall_bookings
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.conference_hall_bookings ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.conference_hall_bookings ALTER COLUMN date_from DROP NOT NULL;
ALTER TABLE public.conference_hall_bookings ALTER COLUMN date_to DROP NOT NULL;
