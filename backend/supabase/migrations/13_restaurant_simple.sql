-- SIMPLE RESTAURANT ENHANCEMENT - New Tables Only
-- No modifications to existing tables

-- ============ ENUMS ============

DO $$ BEGIN
  CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'cleaning', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_split_type AS ENUM ('equal', 'by_item', 'by_guest', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE prep_station_type AS ENUM ('grill', 'salad', 'dessert', 'drinks', 'fry', 'pantry', 'bakery');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============ TABLE MANAGEMENT ============

CREATE TABLE IF NOT EXISTS restaurant_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_capacity CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  section_id UUID REFERENCES restaurant_sections(id),
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  status table_status DEFAULT 'available' NOT NULL,
  position_x DECIMAL(10, 2),
  position_y DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_table_capacity CHECK (capacity > 0),
  CONSTRAINT unique_table_per_branch UNIQUE (branch_id, table_number)
);

CREATE TABLE IF NOT EXISTS restaurant_table_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID REFERENCES restaurant_tables(id) NOT NULL,
  server_id UUID REFERENCES staff_profiles(id) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurant_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  party_size INTEGER NOT NULL,
  quoted_wait_time INTEGER,
  arrived_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  seated_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT,
  CONSTRAINT valid_party_size CHECK (party_size > 0)
);

-- ============ RESERVATIONS ============

CREATE TABLE IF NOT EXISTS restaurant_reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  reservation_number TEXT NOT NULL UNIQUE,
  customer_id UUID,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  party_size INTEGER NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  status reservation_status DEFAULT 'pending' NOT NULL,
  table_id UUID REFERENCES restaurant_tables(id),
  section_preference TEXT,
  special_occasion TEXT,
  dietary_restrictions TEXT[],
  special_requests TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  seated_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  no_show_at TIMESTAMP WITH TIME ZONE,
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_party_size CHECK (party_size > 0),
  CONSTRAINT valid_deposit CHECK (deposit_amount >= 0)
);

-- ============ MENU MODIFIERS ============

CREATE TABLE IF NOT EXISTS restaurant_menu_modifiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_adjustment DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS restaurant_menu_item_modifiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID REFERENCES restaurant_menu_items(id) ON DELETE CASCADE,
  modifier_id UUID REFERENCES restaurant_menu_modifiers(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT false,
  max_selections INTEGER DEFAULT 1,
  CONSTRAINT unique_item_modifier UNIQUE (menu_item_id, modifier_id)
);

-- ============ PREP STATIONS ============

CREATE TABLE IF NOT EXISTS restaurant_prep_stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  name TEXT NOT NULL,
  station_type prep_station_type NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS restaurant_item_station_routing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID REFERENCES restaurant_menu_items(id) ON DELETE CASCADE,
  prep_station_id UUID REFERENCES restaurant_prep_stations(id) ON DELETE CASCADE,
  preparation_sequence INTEGER DEFAULT 1,
  CONSTRAINT unique_item_station UNIQUE (menu_item_id, prep_station_id)
);

-- ============ SUPPLIERS ============

CREATE TABLE IF NOT EXISTS restaurant_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_terms TEXT,
  tax_id TEXT,
  rating DECIMAL(3, 2),
  is_active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- ============ CUSTOMERS ============

CREATE TABLE IF NOT EXISTS restaurant_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  date_of_birth DATE,
  anniversary_date DATE,
  dietary_restrictions TEXT[],
  food_allergies TEXT[],
  preferences JSONB,
  vip BOOLEAN DEFAULT false,
  blacklisted BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  total_visits INTEGER DEFAULT 0,
  total_spend DECIMAL(10, 2) DEFAULT 0,
  average_check DECIMAL(10, 2) DEFAULT 0,
  last_visit_date DATE,
  loyalty_points INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- ============ ENABLE RLS ============

ALTER TABLE restaurant_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_table_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_prep_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_item_station_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_customers ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============

-- Staff can manage all restaurant data
CREATE POLICY "Restaurant staff full access" ON restaurant_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'restaurant'))
  );

CREATE POLICY "Restaurant staff full access" ON restaurant_tables
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'restaurant'))
  );

CREATE POLICY "Restaurant staff full access" ON restaurant_reservations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'restaurant', 'receptionist'))
  );

-- ============ FUNCTIONS ============

CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TEXT AS $$
DECLARE
  res_date TEXT;
  res_seq INT;
  res_number TEXT;
BEGIN
  res_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM restaurant_reservations
    WHERE reservation_number LIKE 'RES' || res_date || '%'
  )
  SELECT next_seq INTO res_seq FROM seq;
  
  res_number := 'RES' || res_date || LPAD(res_seq::TEXT, 4, '0');
  
  RETURN res_number;
END;
$$ LANGUAGE plpgsql;

-- ============ SAMPLE DATA ============

INSERT INTO restaurant_sections (name, capacity, sort_order)
SELECT 'Main Dining', 50, 1
WHERE NOT EXISTS (SELECT 1 FROM restaurant_sections WHERE name = 'Main Dining');

INSERT INTO restaurant_sections (name, capacity, sort_order)
SELECT 'Outdoor Terrace', 30, 2
WHERE NOT EXISTS (SELECT 1 FROM restaurant_sections WHERE name = 'Outdoor Terrace');

INSERT INTO restaurant_sections (name, capacity, sort_order)
SELECT 'Private Room', 20, 3
WHERE NOT EXISTS (SELECT 1 FROM restaurant_sections WHERE name = 'Private Room');
