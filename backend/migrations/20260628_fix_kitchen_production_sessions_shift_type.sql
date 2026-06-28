-- Fix: kitchen_production_sessions never had a shift_type column, despite
-- kitchen/kitchen-production.controller.ts (createProductionSession,
-- listProductionSessions, getShiftHandover, etc.) reading/writing it
-- extensively, and kitchen-controls.controller.ts's analyzeShiftControls /
-- storekeeping/kitchen-stocktake.controller.ts's getKitchenProductionAddedByInvId
-- filtering on it (both confirmed failing live with "column ... shift_type
-- does not exist", 42703).
--
-- Confirmed against the table's original creation DDL
-- (backend/supabase/clean-db/migrations/0040_kitchen_production_system.sql)
-- — no shift_type column was ever defined there. This is a missing column,
-- not a code bug: every read/write site already expects 'shift_a'/'shift_b'
-- string values, matching kitchen_shifts.shift_type's existing convention.

ALTER TABLE public.kitchen_production_sessions
  ADD COLUMN IF NOT EXISTS shift_type VARCHAR(20) DEFAULT 'shift_a';
