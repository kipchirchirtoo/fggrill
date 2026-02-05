-- Fix user creation trigger to satisfy name length constraints
-- Migration: 20260114_fix_user_creation_trigger.sql
-- Created: 2026-01-14

-- Update the handle_new_user function to pull first_name and last_name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_first_name TEXT;
  meta_last_name TEXT;
BEGIN
  -- Extract names from raw_user_meta_data if available
  -- meta_data is a JSONB column in auth.users
  meta_first_name := COALESCE(new.raw_user_meta_data->>'first_name', 'User');
  meta_last_name := COALESCE(new.raw_user_meta_data->>'last_name', 'Account');

  -- Ensure minimum length of 2 characters to satisfy constraints
  IF char_length(meta_first_name) < 2 THEN
    meta_first_name := meta_first_name || ' ';
  END IF;
  
  IF char_length(meta_last_name) < 2 THEN
    meta_last_name := meta_last_name || ' ';
  END IF;

  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    meta_first_name,
    meta_last_name,
    'guest' -- This will be immediately updated by the controller
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to automatically create public.users profile when auth.users is created, using provided metadata.';
