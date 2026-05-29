-- Repair PostgREST relationships used by finance expenses.
-- The live schema may have been created from an older migration where
-- expenses.created_by and expenses.approved_by were plain UUID columns.

DO $$
DECLARE
  expenses_created_by_type text;
  expenses_approved_by_type text;
  users_id_type text;
BEGIN
  SELECT udt_name INTO expenses_created_by_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'expenses'
    AND column_name = 'created_by';

  SELECT udt_name INTO expenses_approved_by_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'expenses'
    AND column_name = 'approved_by';

  SELECT udt_name INTO users_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'id';

  IF expenses_created_by_type = users_id_type
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = 'expenses'
         AND constraint_name = 'expenses_created_by_fkey'
     ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF expenses_approved_by_type = users_id_type
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = 'expenses'
         AND constraint_name = 'expenses_approved_by_fkey'
     ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_approved_by_fkey
      FOREIGN KEY (approved_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
