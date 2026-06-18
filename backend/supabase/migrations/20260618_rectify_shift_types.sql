-- ============================================================
-- RECTIFY KITCHEN SHIFT TYPES
-- From: morning / afternoon / night
-- To:   shift_a / shift_b
-- ============================================================

-- 1. Drop the old CHECK constraint on kitchen_shifts.shift_type
ALTER TABLE kitchen_shifts
DROP CONSTRAINT IF EXISTS kitchen_shifts_shift_type_check;

-- 2. Add the new CHECK constraint
ALTER TABLE kitchen_shifts
ADD CONSTRAINT kitchen_shifts_shift_type_check
CHECK (shift_type IN ('shift_a', 'shift_b'));

-- 3. Update any existing rows (if any) — map morning→shift_a, others→shift_b
UPDATE kitchen_shifts
SET shift_type = CASE shift_type
    WHEN 'morning' THEN 'shift_a'
    WHEN 'afternoon' THEN 'shift_b'
    WHEN 'night' THEN 'shift_b'
    ELSE 'shift_a'
END
WHERE shift_type NOT IN ('shift_a', 'shift_b');

-- 4. Also update the shift_type default in case it was set anywhere
-- (PostgreSQL doesn't have column defaults for CHECK constraints, but just in case)

-- 5. Update kitchen_shift_items, kitchen_shift_stock_take, kitchen_shift_production
--    in case shift_type is stored there (it's not — they reference shift_id)
--    but let's be thorough and check kitchen_production_recipes (no shift_type there either)

-- Done.
