-- =====================================================
-- GROUP MEAL CHANNEL MIGRATION
-- Migration: 20260715_group_meal_channel.sql
-- =====================================================

-- Drop constraints
ALTER TABLE public.kitchen_shift_additions DROP CONSTRAINT IF EXISTS kitchen_shift_additions_purpose_channel_check;
ALTER TABLE public.channel_food_standards DROP CONSTRAINT IF EXISTS channel_food_standards_channel_check;

-- Add updated constraints
ALTER TABLE public.kitchen_shift_additions
  ADD CONSTRAINT kitchen_shift_additions_purpose_channel_check
  CHECK (purpose_channel IN ('pos_restaurant', 'accommodation_breakfast', 'buffet', 'conference_event', 'outside_catering', 'staff_meal', 'group_meal', 'wastage'));

ALTER TABLE public.channel_food_standards
  ADD CONSTRAINT channel_food_standards_channel_check
  CHECK (channel IN ('accommodation_breakfast', 'staff_meal', 'buffet', 'conference_event', 'outside_catering', 'group_meal'));
