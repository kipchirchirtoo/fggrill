-- =====================================================
-- ADD CONFERENCES LINK TO EVENT ORDERS
-- Migration: 20260715_add_hall_booking_to_event_orders.sql
-- Description:
--  1. Adds conference_hall_id and conference_booking_id to event_orders
-- =====================================================

ALTER TABLE public.event_orders
  ADD COLUMN IF NOT EXISTS conference_hall_id UUID REFERENCES public.conference_halls(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conference_booking_id UUID REFERENCES public.conference_hall_bookings(id) ON DELETE SET NULL;
