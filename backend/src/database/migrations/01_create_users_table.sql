-- Create enum for user roles
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'manager',
  'receptionist',
  'housekeeping',
  'restaurant',
  'maintenance',
  'accountant',
  'guest'
);

-- Create users table
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'guest',
  avatar TEXT,
  department TEXT,
  phone_number TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  password_changed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT email_length CHECK (char_length(email) >= 3 AND char_length(email) <= 255),
  CONSTRAINT first_name_length CHECK (char_length(first_name) >= 2 AND char_length(first_name) <= 50),
  CONSTRAINT last_name_length CHECK (char_length(last_name) >= 2 AND char_length(last_name) <= 50)
);

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own profile
CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy for super_admin to view all profiles
CREATE POLICY "Super admin can view all profiles"
  ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Policy for super_admin to update all profiles
CREATE POLICY "Super admin can update all profiles"
  ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    '',  -- Will be updated later
    '',  -- Will be updated later
    'guest'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
