-- ============================================================
-- Migration: 20260729_breakfast_pax_indexes.sql
-- Purpose  : Add targeted indexes for the Breakfast Pax screen
--            (Reception > Breakfast Pax) to eliminate full-table
--            scans and speed up every load / save operation.
-- 
-- Screens / queries covered:
--   1. calculateBreakfastPaxSnapshot — fetches all checked-in
--      reservations for a branch, joins guests, rooms, room_types
--      and rate_plans.
--   2. getBreakfastPaxRecord — point-lookup on branch + date.
--   3. upsertDailyBreakfastPax — same point-lookup + upsert.
--   4. rate_plans bulk-lookup by branch + active + room_type_ids.
-- ============================================================

-- ── 1. reservations ──────────────────────────────────────────
-- The single heaviest query: WHERE branch_id = X AND status = 'checked_in'
-- This covers both the Breakfast Pax load AND the general "in-house" reads.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reservations_branch_status
  ON reservations (branch_id, status);

-- Also index check_in_date / check_out_date so date-range filters
-- (used when the receptionist selects a past / future service date)
-- can be resolved without a seq-scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reservations_checkin_date
  ON reservations (branch_id, check_in_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reservations_checkout_date
  ON reservations (branch_id, check_out_date);

-- Composite: status + check_in_date range (used by in-house queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reservations_branch_status_dates
  ON reservations (branch_id, status, check_in_date, check_out_date);

-- FK support: guest_id → guests, room_id → rooms, rate_plan_id → rate_plans
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reservations_guest_id
  ON reservations (guest_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reservations_room_id
  ON reservations (room_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reservations_rate_plan_id
  ON reservations (rate_plan_id);

-- meal_plan filter (used by mealPlanIncludesBreakfast checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reservations_meal_plan
  ON reservations (branch_id, meal_plan)
  WHERE meal_plan IS NOT NULL;

-- ── 2. accommodation_breakfast_pax ───────────────────────────
-- getBreakfastPaxRecord: WHERE branch_id = X AND breakfast_date = Y
-- Unique index also enforces one record per branch per date.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  idx_breakfast_pax_branch_date
  ON accommodation_breakfast_pax (branch_id, breakfast_date);

-- Status index for filtering confirmed/draft/locked records
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_breakfast_pax_status
  ON accommodation_breakfast_pax (branch_id, status);

-- ── 3. rate_plans ─────────────────────────────────────────────
-- Bulk fetch: WHERE branch_id = X AND is_active = true
--             AND room_type_id IN (...)
-- Composite covering index handles both conditions in one scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_rate_plans_branch_active_room_type
  ON rate_plans (branch_id, is_active, room_type_id);

-- meal_plan on rate_plans (mealPlanIncludesBreakfast filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_rate_plans_meal_plan
  ON rate_plans (branch_id, meal_plan)
  WHERE meal_plan IS NOT NULL;

-- ── 4. rooms ──────────────────────────────────────────────────
-- Joined from reservations via room_id; room_type_id FK used
-- to pull room_types.  Add index on room_type_id so the nested
-- join resolves fast.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_rooms_room_type_id
  ON rooms (room_type_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_rooms_branch_id
  ON rooms (branch_id);

-- ── 5. guests ────────────────────────────────────────────────
-- Joined on guest_id; first_name / last_name used in display.
-- PK is already indexed; add name index for search bar lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_guests_name
  ON guests (branch_id, lower(last_name), lower(first_name));

-- ── 6. Analyze after indexing ─────────────────────────────────
ANALYZE reservations;
ANALYZE accommodation_breakfast_pax;
ANALYZE rate_plans;
ANALYZE rooms;
ANALYZE guests;
