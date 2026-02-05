-- Fix the handle_new_user trigger to use proper placeholder values
-- This ensures empty strings are never inserted, which violates the first_name_length constraint

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_first_name TEXT;
  meta_last_name TEXT;
BEGIN
  -- Extract names from raw_user_meta_data if available
  meta_first_name := COALESCE(new.raw_user_meta_data->>'first_name', 'User');
  meta_last_name := COALESCE(new.raw_user_meta_data->>'last_name', 'Account');

  -- Ensure minimum length of 2 characters to satisfy 'first_name_length' constraint
  IF char_length(meta_first_name) < 2 THEN
    meta_first_name := 'User';
  END IF;
  
  IF char_length(meta_last_name) < 2 THEN
    meta_last_name := 'Account';
  END IF;

  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    meta_first_name,
    meta_last_name,
    'guest' -- Default role, will be updated by the controller
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to automatically create public.users profile when auth.users is created. Uses User/Account as defaults to satisfy length constraints.';
