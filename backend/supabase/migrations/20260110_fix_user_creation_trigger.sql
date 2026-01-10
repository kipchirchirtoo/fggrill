-- Fix the handle_new_user trigger to use placeholder values that meet the constraint
-- The constraint requires first_name and last_name to be between 2 and 50 characters
-- Empty strings ('') violate this constraint

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE((new.raw_user_meta_data->>'first_name')::text, 'Pending'),
    COALESCE((new.raw_user_meta_data->>'last_name')::text, 'User'),
    'guest'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
