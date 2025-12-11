-- Enhanced Booking System Schema Migration
-- This migration upgrades the existing schema to the full-stack requirements

-- 1. Enhance Guests Table
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(5),
ADD COLUMN IF NOT EXISTS id_expiry DATE,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS vip_tier VARCHAR(20), -- silver, gold, platinum
ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Enhance Room Types Table
ALTER TABLE room_types
ADD COLUMN IF NOT EXISTS code VARCHAR(20),
ADD COLUMN IF NOT EXISTS max_adults INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS max_children INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS size_sqm DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS bed_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Add unique constraint to code if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_types_code_key') THEN
        ALTER TABLE room_types ADD CONSTRAINT room_types_code_key UNIQUE (code);
    END IF;
END $$;

-- 3. Enhance Rooms Table
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS building VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_smoking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS connecting_rooms JSONB,
ADD COLUMN IF NOT EXISTS features JSONB,
ADD COLUMN IF NOT EXISTS last_cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 4. Enhance Rate Plans Table
ALTER TABLE rate_plans
ADD COLUMN IF NOT EXISTS code VARCHAR(20),
ADD COLUMN IF NOT EXISTS rate_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_percentage BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS fixed_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS min_nights INTEGER,
ADD COLUMN IF NOT EXISTS max_nights INTEGER,
ADD COLUMN IF NOT EXISTS advance_booking_days INTEGER,
ADD COLUMN IF NOT EXISTS days_of_week JSONB,
ADD COLUMN IF NOT EXISTS blackout_dates JSONB,
ADD COLUMN IF NOT EXISTS refundable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cancellation_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS deposit_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS inclusions JSONB,
ADD COLUMN IF NOT EXISTS restrictions TEXT;

-- Add unique constraint to code if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_code_key') THEN
        ALTER TABLE rate_plans ADD CONSTRAINT rate_plans_code_key UNIQUE (code);
    END IF;
END $$;

-- 5. Enhance Reservations Table
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS arrival_time TIME,
ADD COLUMN IF NOT EXISTS departure_time TIME,
ADD COLUMN IF NOT EXISTS infants INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS room_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS channel_manager_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS meal_plan VARCHAR(20),
ADD COLUMN IF NOT EXISTS purpose VARCHAR(50),
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by UUID,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS checked_in_by UUID,
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS checked_out_by UUID,
ADD COLUMN IF NOT EXISTS early_checkin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_checkout BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_checkout_charge DECIMAL(10,2);

-- Add branch_id if not exists (it might be in some schemas)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS branch_id UUID;

-- 6. Enhance Folios Table
ALTER TABLE folios
ADD COLUMN IF NOT EXISTS folio_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS room_charges DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS food_charges DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS beverage_charges DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_charges DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS settled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 7. Enhance Transactions Table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS card_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4),
ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS posted_by UUID,
ADD COLUMN IF NOT EXISTS void BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS void_reason TEXT,
ADD COLUMN IF NOT EXISTS voided_by UUID,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;

-- 8. Create New Tables

-- Guest Documents
CREATE TABLE IF NOT EXISTS guest_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_id UUID REFERENCES guests(id) NOT NULL,
  reservation_id UUID REFERENCES reservations(id),
  document_type VARCHAR(50),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room Blocks
CREATE TABLE IF NOT EXISTS room_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) NOT NULL,
  block_type VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group Bookings
CREATE TABLE IF NOT EXISTS group_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_name VARCHAR(200) NOT NULL,
  group_code VARCHAR(20) UNIQUE,
  organizer_name VARCHAR(200),
  organizer_email VARCHAR(255),
  organizer_phone VARCHAR(20),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  total_rooms INTEGER,
  rooming_list JSONB,
  group_rate DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  contract_url TEXT,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'TENTATIVE',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reservation Guests (Additional Guests)
CREATE TABLE IF NOT EXISTS reservation_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES reservations(id) NOT NULL,
  guest_id UUID REFERENCES guests(id),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  age INTEGER,
  is_child BOOLEAN DEFAULT false,
  relationship VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Housekeeping Logs
CREATE TABLE IF NOT EXISTS housekeeping_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) NOT NULL,
  reservation_id UUID REFERENCES reservations(id),
  cleaned_by UUID,
  cleaned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20),
  quality_score INTEGER,
  issues_found TEXT,
  time_spent_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_status_branch ON reservations(status, branch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_availability ON rooms(status, room_type_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_logs_room ON housekeeping_logs(room_id);
