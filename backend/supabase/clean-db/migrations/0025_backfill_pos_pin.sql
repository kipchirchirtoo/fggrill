-- ============================================================
-- 0025_backfill_pos_pin.sql
-- Backfill users.pos_pin from metadata->>'pos_pin' for every
-- user where the column is NULL but metadata carries the value.
-- Also ensure the trigger in 0011 still keeps them in sync.
-- ============================================================

-- Backfill pos_pin from metadata
UPDATE public.users
  SET pos_pin    = TRIM(metadata->>'pos_pin'),
      updated_at = NOW()
  WHERE (pos_pin IS NULL OR pos_pin = '')
    AND TRIM(metadata->>'pos_pin') IS NOT NULL
    AND TRIM(metadata->>'pos_pin') != '';

-- Verify
DO $$
DECLARE
  total_users   INT;
  users_with_pin INT;
BEGIN
  SELECT COUNT(*)                    INTO total_users   FROM public.users;
  SELECT COUNT(*)                    INTO users_with_pin FROM public.users WHERE pos_pin IS NOT NULL AND pos_pin != '';
  RAISE NOTICE 'pos_pin backfill complete: % / % users now have a POS PIN', users_with_pin, total_users;
END;
$$;
