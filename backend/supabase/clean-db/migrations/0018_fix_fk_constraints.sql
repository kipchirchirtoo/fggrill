-- =============================================================
-- 0018: Fix FK constraint issues causing PGRST200/201 errors
--
-- Errors fixed:
-- 1. GET /api/rooms  → PGRST200: no relationship rooms→room_types via type_id
-- 2. GET /api/conference/bookings → PGRST201: dual FK on conference_hall_bookings→conference_halls
-- 3. GET /api/cashier/unpaid-bills → PGRST200: no relationship shift_transactions→branches
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: rooms.type_id → room_types(id)
-- room.controller.ts selects: type:room_types!type_id(*)
-- The column exists but PostgREST can't find it because the FK
-- constraint was never created. rooms.room_type_id already has FK;
-- type_id is the column the controllers actually use.
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rooms_type_id_fkey' AND table_name = 'rooms'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_type_id_fkey
      FOREIGN KEY (type_id) REFERENCES room_types(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- FIX 2: conference_hall_bookings dual FK ambiguity
-- After migration 0015, both hall_id_fkey AND conference_hall_id_fkey
-- point to conference_halls(id). PostgREST can't resolve:
--   select('*, hall:conference_halls(*)')  ← PGRST201
-- Solution: drop the old hall_id FK. The canonical column is now
-- conference_hall_id (added in 0015, used by conference.controller.ts).
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'conference_hall_bookings_hall_id_fkey'
    AND table_name = 'conference_hall_bookings'
  ) THEN
    ALTER TABLE conference_hall_bookings DROP CONSTRAINT conference_hall_bookings_hall_id_fkey;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- FIX 3: shift_transactions is a VIEW, not a table.
-- Cannot add FK constraints to views.
-- Fixed in cashier.controller.ts by removing the FK join hint.
-- ---------------------------------------------------------------
