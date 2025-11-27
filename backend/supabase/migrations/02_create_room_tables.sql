-- Create room types enum
CREATE TYPE room_type AS ENUM (
  'Standard',
  'Deluxe',
  'Suite'
);

-- Create room status enum
CREATE TYPE room_status AS ENUM (
  'available',
  'occupied',
  'cleaning',
  'maintenance',
  'out_of_order'
);

-- Create room amenities enum
CREATE TYPE room_amenity AS ENUM (
  'wifi',
  'tv',
  'ac',
  'minibar',
  'balcony',
  'jacuzzi',
  'kitchen'
);

-- Create room types table
CREATE TABLE room_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name room_type NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  max_occupancy INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create rooms table
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number TEXT NOT NULL UNIQUE,
  type_id UUID REFERENCES room_types(id) NOT NULL,
  floor INT NOT NULL,
  status room_status DEFAULT 'available' NOT NULL,
  price_override DECIMAL(10, 2),
  amenities room_amenity[] DEFAULT '{}' NOT NULL,
  last_cleaned TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_room_number CHECK (char_length(room_number) >= 1 AND char_length(room_number) <= 10),
  CONSTRAINT valid_floor CHECK (floor >= 1 AND floor <= 100)
);

-- Create room status history table
CREATE TABLE room_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) NOT NULL,
  previous_status room_status NOT NULL,
  new_status room_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create RLS policies
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_status_history ENABLE ROW LEVEL SECURITY;

-- Room types policies
CREATE POLICY "Anyone can view room types"
  ON room_types
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins and managers can modify room types"
  ON room_types
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- Rooms policies
CREATE POLICY "Anyone can view rooms"
  ON rooms
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins, managers, and housekeeping can modify rooms"
  ON rooms
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

-- Room status history policies
CREATE POLICY "Anyone can view room status history"
  ON room_status_history
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins, managers, and housekeeping can add room status history"
  ON room_status_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

-- Create function to update room status history
CREATE OR REPLACE FUNCTION update_room_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO room_status_history (
      room_id,
      previous_status,
      new_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for room status changes
CREATE TRIGGER on_room_status_change
  AFTER UPDATE OF status ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_room_status_history();

-- Insert default room types
INSERT INTO room_types (name, description, base_price, max_occupancy) VALUES
('Standard', 'Comfortable standard room with essential amenities', 5000, 2),
('Deluxe', 'Spacious room with additional amenities and better views', 8000, 3),
('Suite', 'Luxury suite with separate living area and premium amenities', 15000, 4);
