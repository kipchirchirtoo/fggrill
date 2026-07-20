-- =====================================================
-- CHANNEL-BASED FOOD CONTROL SYSTEM SCHEMA
-- Migration: 20260715_channel_based_food_control.sql
-- Description:
--  1. Adds breakfast_pax and staff_meal_pax to kitchen_shifts
--  2. Adds purpose_channel, reference_id, and wastage_reason to kitchen_shift_additions
--  3. Creates buffets, catering_events, and channel_food_standards tables
-- =====================================================

-- 1. Alter kitchen_shifts table
ALTER TABLE public.kitchen_shifts
  ADD COLUMN IF NOT EXISTS breakfast_pax INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_meal_pax INTEGER NOT NULL DEFAULT 0;

-- 2. Alter kitchen_shift_additions table
ALTER TABLE public.kitchen_shift_additions
  ADD COLUMN IF NOT EXISTS purpose_channel VARCHAR(50) NOT NULL DEFAULT 'pos_restaurant'
    CHECK (purpose_channel IN ('pos_restaurant', 'accommodation_breakfast', 'buffet', 'conference_event', 'outside_catering', 'staff_meal', 'wastage')),
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS wastage_reason TEXT;

-- 3. Create buffets table
--    amount_paid tracks deposits so normalizeSourceRow can show real balance.
--    invoice_id FK allows bestEffortLinkInvoiceToSource to write back after generation.
CREATE TABLE IF NOT EXISTS public.buffets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  pax INTEGER NOT NULL DEFAULT 0 CHECK (pax >= 0),
  amount_charged NUMERIC(14,2) DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'credit')),
  invoice_id UUID REFERENCES public.accounting_ar_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create catering_events table
--    amount_paid and invoice_id are required for the same reason as buffets.
CREATE TABLE IF NOT EXISTS public.catering_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  pax INTEGER NOT NULL DEFAULT 0 CHECK (pax >= 0),
  location VARCHAR(255),
  amount_charged NUMERIC(14,2) DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'credit')),
  invoice_id UUID REFERENCES public.accounting_ar_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create channel_food_standards table
CREATE TABLE IF NOT EXISTS public.channel_food_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('accommodation_breakfast', 'staff_meal', 'buffet', 'conference_event', 'outside_catering')),
  event_id UUID, -- NULL for breakfast/staff meal; references buffets.id, conference_hall_bookings.id, or catering_events.id for events
  raw_item_sku VARCHAR(100) NOT NULL,
  raw_item_name VARCHAR(255) NOT NULL,
  quantity_per_pax NUMERIC(10,4) NOT NULL CHECK (quantity_per_pax >= 0),
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_branch_channel_event_sku UNIQUE (branch_id, channel, event_id, raw_item_sku)
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.buffets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catering_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_food_standards ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies — buffets
CREATE POLICY "buffets_select"
ON public.buffets FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "buffets_insert"
ON public.buffets FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "buffets_update"
ON public.buffets FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "buffets_delete"
ON public.buffets FOR DELETE USING (auth.role() = 'authenticated');

-- 8. RLS Policies — catering_events
CREATE POLICY "catering_events_select"
ON public.catering_events FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "catering_events_insert"
ON public.catering_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "catering_events_update"
ON public.catering_events FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "catering_events_delete"
ON public.catering_events FOR DELETE USING (auth.role() = 'authenticated');

-- 9. RLS Policies — channel_food_standards
CREATE POLICY "channel_food_standards_select"
ON public.channel_food_standards FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "channel_food_standards_insert"
ON public.channel_food_standards FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "channel_food_standards_update"
ON public.channel_food_standards FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "channel_food_standards_delete"
ON public.channel_food_standards FOR DELETE USING (auth.role() = 'authenticated');
