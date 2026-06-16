-- Backfill users.branch_id from user_branch_roles where null
-- Fixes branch isolation bug after migration from UUID to integer branch IDs
-- Safe to run multiple times (WHERE branch_id IS NULL guard).

UPDATE users u
SET branch_id = (
  SELECT ubr.branch_id
  FROM user_branch_roles ubr
  WHERE ubr.user_id = u.id
  ORDER BY ubr.is_primary DESC, ubr.created_at ASC
  LIMIT 1
)
WHERE u.branch_id IS NULL
  AND EXISTS (
    SELECT 1 FROM user_branch_roles ubr WHERE ubr.user_id = u.id AND ubr.branch_id IS NOT NULL
  );

-- Log how many rows were updated (informational)
DO $$
DECLARE
  updated_count integer;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled branch_id for % user(s)', updated_count;
END $$;
