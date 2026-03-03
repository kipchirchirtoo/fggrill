-- Employee & Guest Portal Tables Migration
-- Created: 2025-12-14

-- =====================================================
-- EMPLOYEE PORTAL TABLES
-- =====================================================

-- Employee Announcements (company-wide or branch-specific)
CREATE TABLE IF NOT EXISTS employee_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  branch_id INTEGER REFERENCES branches(id),
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Employee Documents (payslips, contracts, policies)
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('payslip', 'contract', 'policy', 'certificate', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  month INTEGER,
  year INTEGER,
  is_read BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Employee Time Clock (clock in/out records)
CREATE TABLE IF NOT EXISTS employee_time_clock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  break_minutes INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'adjusted')),
  adjusted_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Employee Tasks (assigned tasks)
CREATE TABLE IF NOT EXISTS employee_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  assigned_by UUID REFERENCES users(id) NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Employee Training Records
CREATE TABLE IF NOT EXISTS employee_training (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  training_name TEXT NOT NULL,
  training_type TEXT CHECK (training_type IN ('onboarding', 'safety', 'skills', 'compliance', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  due_date DATE,
  completed_date DATE,
  certificate_url TEXT,
  score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- GUEST PORTAL TABLES
-- =====================================================

-- Guest Service Requests (room service, housekeeping, etc.)
CREATE TABLE IF NOT EXISTS guest_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES users(id) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  branch_id INTEGER REFERENCES branches(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('room_service', 'housekeeping', 'maintenance', 'amenity', 'transport', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES users(id),
  room_number TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Guest Messages (communication with hotel)
CREATE TABLE IF NOT EXISTS guest_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES users(id) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  branch_id INTEGER REFERENCES branches(id),
  subject TEXT,
  message TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('guest', 'staff')),
  sender_id UUID REFERENCES users(id) NOT NULL,
  is_read BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES guest_messages(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest Feedback/Reviews
CREATE TABLE IF NOT EXISTS guest_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES users(id) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  branch_id INTEGER REFERENCES branches(id),
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
  amenities_rating INTEGER CHECK (amenities_rating BETWEEN 1 AND 5),
  value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 5),
  comment TEXT,
  would_recommend BOOLEAN,
  is_public BOOLEAN DEFAULT false,
  response TEXT,
  responded_by UUID REFERENCES users(id),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Guest Loyalty Points
CREATE TABLE IF NOT EXISTS guest_loyalty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES users(id) NOT NULL UNIQUE,
  total_points INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  total_stays INTEGER DEFAULT 0,
  total_spent DECIMAL(12, 2) DEFAULT 0,
  member_since DATE DEFAULT CURRENT_DATE,
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Guest Loyalty Transactions
CREATE TABLE IF NOT EXISTS guest_loyalty_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES users(id) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'bonus', 'adjustment')),
  points INTEGER NOT NULL,
  description TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest Saved Preferences (extended)
CREATE TABLE IF NOT EXISTS guest_saved_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES users(id) NOT NULL,
  category TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(guest_id, category, preference_key)
);

-- Hotel Amenities (for guest portal display)
CREATE TABLE IF NOT EXISTS hotel_amenities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('dining', 'wellness', 'recreation', 'business', 'transport', 'other')),
  icon TEXT,
  operating_hours TEXT,
  contact_info TEXT,
  is_bookable BOOLEAN DEFAULT false,
  price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Amenity Bookings
CREATE TABLE IF NOT EXISTS amenity_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amenity_id UUID REFERENCES hotel_amenities(id) NOT NULL,
  guest_id UUID REFERENCES users(id) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_minutes INTEGER,
  guests_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  special_requests TEXT,
  total_amount DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_employee_announcements_branch ON employee_announcements(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_announcements_active ON employee_announcements(is_active, published_at);
CREATE INDEX IF NOT EXISTS idx_employee_documents_user ON employee_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_time_clock_user ON employee_time_clock(user_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_user ON employee_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_employee_training_user ON employee_training(user_id);

CREATE INDEX IF NOT EXISTS idx_guest_requests_guest ON guest_requests(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_requests_booking ON guest_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_requests_status ON guest_requests(status);
CREATE INDEX IF NOT EXISTS idx_guest_messages_guest ON guest_messages(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_feedback_guest ON guest_feedback(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_loyalty_guest ON guest_loyalty(guest_id);
CREATE INDEX IF NOT EXISTS idx_amenity_bookings_guest ON amenity_bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_amenity_bookings_date ON amenity_bookings(scheduled_date);

-- =====================================================
-- DEMO USERS FOR EMPLOYEE AND GUEST PORTALS
-- =====================================================

-- Ensure users table has password_hash column (used by some portal features)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Insert demo employee user
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, branch_id)
VALUES (
  'e1000000-0000-0000-0000-000000000001',
  'employee@kyogong.com',
  '$2b$10$rQEY9zL5qK8xH3mN7pJ1/.XvYwZ4kL6mN8oP0qR2sT4uV6wX8yZ0a',
  'John',
  'Employee',
  'employee',
  'active',
  1
) ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role;

-- Insert demo guest user
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status)
VALUES (
  'f1000000-0000-0000-0000-000000000001',
  'guest@kyogong.com',
  '$2b$10$rQEY9zL5qK8xH3mN7pJ1/.XvYwZ4kL6mN8oP0qR2sT4uV6wX8yZ0a',
  'Jane',
  'Guest',
  'guest',
  'active'
) ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role;

-- Create staff profile for employee
INSERT INTO staff_profiles (user_id, role, department, shift, salary, start_date, id_number, status)
SELECT 
  id,
  'employee',
  'housekeeping',
  'morning',
  35000,
  '2024-01-15',
  'EMP001234',
  'active'
FROM users WHERE email = 'employee@kyogong.com'
AND NOT EXISTS (
  SELECT 1 FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE u.email = 'employee@kyogong.com'
);

-- Create guest profile
INSERT INTO guest_profiles (user_id, id_type, id_number, nationality, vip_status)
SELECT 
  id,
  'passport',
  'AB1234567',
  'Kenya',
  false
FROM users WHERE email = 'guest@kyogong.com'
AND NOT EXISTS (
  SELECT 1 FROM guest_profiles gp JOIN users u ON gp.user_id = u.id WHERE u.email = 'guest@kyogong.com'
);

-- Create guest loyalty record
INSERT INTO guest_loyalty (guest_id, total_points, tier, total_stays, total_spent)
SELECT 
  id,
  1500,
  'silver',
  3,
  45000
FROM users WHERE email = 'guest@kyogong.com'
AND NOT EXISTS (
  SELECT 1 FROM guest_loyalty gl JOIN users u ON gl.guest_id = u.id WHERE u.email = 'guest@kyogong.com'
);

-- Insert sample hotel amenities
INSERT INTO hotel_amenities (branch_id, name, description, category, operating_hours, is_bookable, price, is_active)
VALUES 
  (1, 'Restaurant', 'Fine dining experience with local and international cuisine', 'dining', '6:00 AM - 10:00 PM', true, 0, true),
  (1, 'Room Service', '24/7 in-room dining service', 'dining', '24 Hours', false, 0, true),
  (1, 'Swimming Pool', 'Outdoor heated pool with sun loungers', 'recreation', '6:00 AM - 8:00 PM', false, 0, true),
  (1, 'Gym & Fitness', 'Fully equipped fitness center', 'wellness', '5:00 AM - 10:00 PM', false, 0, true),
  (1, 'Spa & Massage', 'Relaxing spa treatments and massages', 'wellness', '9:00 AM - 9:00 PM', true, 2500, true),
  (1, 'Business Center', 'Meeting rooms and business facilities', 'business', '8:00 AM - 6:00 PM', true, 1500, true),
  (1, 'Airport Transfer', 'Comfortable airport pickup and drop-off', 'transport', '24 Hours', true, 3500, true),
  (1, 'Laundry Service', 'Same-day laundry and dry cleaning', 'other', '7:00 AM - 7:00 PM', false, 0, true)
ON CONFLICT DO NOTHING;
