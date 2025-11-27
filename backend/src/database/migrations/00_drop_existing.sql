-- Drop all existing tables and types
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  -- Drop all tables in reverse order to handle dependencies
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename DESC) 
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;

  -- Drop all types
  FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON (t.typnamespace = n.oid) WHERE n.nspname = 'public' AND t.typtype = 'e') 
  LOOP
    EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;

  -- Drop all functions
  FOR r IN (SELECT proname, oid::regprocedure AS fullname FROM pg_proc WHERE pronamespace = 'public'::regnamespace) 
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fullname || ' CASCADE';
  END LOOP;
END $$;
