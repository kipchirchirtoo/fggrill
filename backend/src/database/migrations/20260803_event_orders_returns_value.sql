-- Phase 2 food control: Outside Catering (and other event) net food cost must
-- subtract stock returned unused after the event. Captured on the Event Order
-- at close. net_food_cost = issued_cost - returns_value - approved_wastage.
ALTER TABLE public.event_orders
  ADD COLUMN IF NOT EXISTS returns_value numeric NOT NULL DEFAULT 0;
