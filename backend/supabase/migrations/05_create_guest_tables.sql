-- Create guest profiles table
CREATE TABLE guest_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  id_type TEXT NOT NULL,
  id_number TEXT NOT NULL,
  nationality TEXT NOT NULL,
  address TEXT,
  company TEXT,
  vip_status BOOLEAN DEFAULT false NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_id_number CHECK (char_length(id_number) >= 3 AND char_length(id_number) <= 50)
);

-- Create guest preferences table
CREATE TABLE guest_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES guest_profiles(id) NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(guest_id, preference_key)
);

-- Create guest stay history view
CREATE VIEW guest_stay_history AS
SELECT 
  g.id as guest_id,
  u.first_name,
  u.last_name,
  u.email,
  COUNT(DISTINCT b.id) as total_stays,
  SUM(b.total_amount) as total_spent,
  MAX(b.check_in_date) as last_stay,
  g.vip_status
FROM guest_profiles g
JOIN users u ON u.id = g.user_id
LEFT JOIN bookings b ON b.guest_id = u.id
GROUP BY g.id, u.first_name, u.last_name, u.email, g.vip_status;

-- Enable RLS
ALTER TABLE guest_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_preferences ENABLE ROW LEVEL SECURITY;

-- Guest profiles policies
CREATE POLICY "Users can view their own profile"
  ON guest_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all guest profiles"
  ON guest_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

CREATE POLICY "Staff can create guest profiles"
  ON guest_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

CREATE POLICY "Staff can update guest profiles"
  ON guest_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

-- Guest preferences policies
CREATE POLICY "Users can view their own preferences"
  ON guest_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guest_profiles 
      WHERE id = guest_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all guest preferences"
  ON guest_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

CREATE POLICY "Staff can manage guest preferences"
  ON guest_preferences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

-- Create function to automatically create guest profile
CREATE OR REPLACE FUNCTION create_guest_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'guest' THEN
    INSERT INTO guest_profiles (user_id, id_type, id_number, nationality)
    VALUES (NEW.id, 'pending', 'pending', 'pending');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new guest users
CREATE TRIGGER on_guest_user_created
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.role = 'guest')
  EXECUTE FUNCTION create_guest_profile();

-- Create function to update guest profile timestamps
CREATE OR REPLACE FUNCTION update_guest_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_guest_profile_timestamp
  BEFORE UPDATE ON guest_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_guest_profile_timestamp();

CREATE TRIGGER update_guest_preference_timestamp
  BEFORE UPDATE ON guest_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_guest_profile_timestamp();
