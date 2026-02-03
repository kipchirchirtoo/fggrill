-- =====================================================
-- MULTI-BRANCH SUPPORT FIXES
-- =====================================================
ALTER TABLE hk_staff_profiles ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE hk_staff_points ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE hk_staff_achievements ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE hk_staff_schedules ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Fix foreign keys to use hk_staff_profiles instead of staff_profiles where appropriate
ALTER TABLE hk_inspections DROP COLUMN IF EXISTS inspected_by CASCADE;
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES hk_staff_profiles(id);

-- Restore original comprehensive fixes
ALTER TABLE hk_staff_profiles ADD COLUMN IF NOT EXISTS assigned_floors INTEGER[];
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS result VARCHAR(20) CHECK (result IN ('pass', 'fail', 'pending'));
ALTER TABLE hk_lost_found ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS inspection_number VARCHAR(50);
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS task_number VARCHAR(50);
ALTER TABLE hk_lost_found ADD COLUMN IF NOT EXISTS item_number VARCHAR(50);
ALTER TABLE hk_maintenance_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '[]';
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS total_estimated_time INTEGER;
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE hk_checklist_templates DROP COLUMN IF EXISTS items;
ALTER TABLE hk_checklist_templates DROP COLUMN IF EXISTS estimated_minutes;

-- =====================================================

-- =====================================================
-- ENHANCED HOUSEKEEPING MODULE - COMPLETE MIGRATION
-- Version: 2.0
-- Description: Comprehensive housekeeping management system
-- =====================================================

-- =====================================================
-- SECTION 1: ENHANCED ENUMS
-- =====================================================

-- Drop existing enums if they exist and recreate with enhanced values
DO $$ BEGIN
  -- Room Status Enum (comprehensive)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_room_status') THEN
    CREATE TYPE hk_room_status AS ENUM (
      'vacant_clean',        -- VC: Room is clean, inspected, ready for occupancy
      'vacant_dirty',        -- VD: Room is vacant but needs cleaning
      'occupied_clean',      -- OC: Guest-occupied room that has been serviced
      'occupied_dirty',      -- OD: Guest-occupied room pending service
      'out_of_order',        -- OO: Room unavailable due to maintenance
      'out_of_service',      -- OS: Room temporarily unavailable for other reasons
      'inspected',           -- Cleaned and awaiting final inspection
      'cleaning_in_progress', -- Room currently being cleaned
      'do_not_disturb',      -- DND: Guest has requested no service
      'stay_over',           -- Guest staying another night, requires light service
      'checkout',            -- Guest has departed, full cleaning required
      'early_makeup',        -- Guest requests service before standard time
      'late_checkout',       -- Guest requested late checkout
      'turndown_pending',    -- Turndown service pending
      'turndown_complete'    -- Turndown service completed
    );
  END IF;
  
  -- Task Type Enum (enhanced)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_task_type') THEN
    CREATE TYPE hk_task_type AS ENUM (
      'checkout_full_clean',    -- Full cleaning after guest checkout
      'checkout_vip_clean',     -- VIP room full cleaning
      'stay_over_service',      -- Quick service for staying guests
      'stay_over_full',         -- Full service for staying guests
      'deep_clean',             -- Deep cleaning (periodic)
      'turndown_service',       -- Evening turndown service
      'inspection',             -- Room inspection
      'touch_up',               -- Quick touch-up
      'linen_change',           -- Linen change only
      'restock_amenities',      -- Restock amenities only
      'public_area_clean',      -- Public area cleaning
      'emergency_clean',        -- Emergency cleaning request
      'guest_request',          -- Guest special request
      'pre_arrival_vip'         -- VIP pre-arrival preparation
    );
  END IF;

  -- Task Priority Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_priority') THEN
    CREATE TYPE hk_priority AS ENUM (
      'critical',   -- Safety/emergency, immediate attention
      'urgent',     -- VIP or time-critical
      'high',       -- Important, same-day
      'normal',     -- Standard priority
      'low'         -- Can be deferred
    );
  END IF;

  -- Task Status Enum (enhanced workflow)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_task_status') THEN
    CREATE TYPE hk_task_status AS ENUM (
      'pending',           -- Task created, not started
      'assigned',          -- Assigned to staff
      'in_progress',       -- Currently being worked on
      'paused',            -- Temporarily paused (DND, etc.)
      'completed',         -- Cleaning completed
      'pending_inspection', -- Awaiting supervisor inspection
      'inspection_passed', -- Inspection passed
      'inspection_failed', -- Inspection failed, needs rework
      'rework_required',   -- Reassigned for corrections
      'cancelled',         -- Task cancelled
      'skipped'            -- Skipped (DND, guest declined)
    );
  END IF;

  -- Inspection Result Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_inspection_result') THEN
    CREATE TYPE hk_inspection_result AS ENUM (
      'passed',
      'passed_with_notes',
      'failed',
      'needs_rework'
    );
  END IF;

  -- Shift Type Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_shift_type') THEN
    CREATE TYPE hk_shift_type AS ENUM (
      'morning',    -- 6AM - 2PM typical
      'afternoon',  -- 2PM - 10PM typical
      'evening',    -- 6PM - 10PM (turndown)
      'night',      -- 10PM - 6AM
      'split'       -- Split shift
    );
  END IF;

  -- Linen Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_linen_status') THEN
    CREATE TYPE hk_linen_status AS ENUM (
      'clean_available',    -- Clean and in storage
      'in_use',             -- Currently on rooms
      'soiled_collected',   -- Collected, pending laundry
      'in_laundry',         -- At laundry facility
      'damaged',            -- Damaged, needs replacement
      'retired'             -- End of life
    );
  END IF;

  -- Lost & Found Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_lost_found_status') THEN
    CREATE TYPE hk_lost_found_status AS ENUM (
      'found',              -- Item found, not claimed
      'guest_contacted',    -- Guest has been notified
      'claimed',            -- Guest claimed the item
      'shipped',            -- Item shipped to guest
      'unclaimed',          -- Past retention period
      'disposed',           -- Donated or disposed
      'stored'              -- In storage
    );
  END IF;

  -- Maintenance Request Status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_maintenance_status') THEN
    CREATE TYPE hk_maintenance_status AS ENUM (
      'submitted',
      'acknowledged',
      'assigned',
      'in_progress',
      'completed',
      'verified',
      'cancelled'
    );
  END IF;

  -- Supply Request Status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hk_supply_request_status') THEN
    CREATE TYPE hk_supply_request_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'fulfilled',
      'partially_fulfilled',
      'cancelled'
    );
  END IF;

END $$;

-- =====================================================
-- SECTION 2: HOUSEKEEPING STAFF PROFILES
-- =====================================================

-- Housekeeping-specific staff information
CREATE TABLE IF NOT EXISTS hk_staff_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  staff_code VARCHAR(20) UNIQUE NOT NULL,
  designation VARCHAR(100) NOT NULL, -- Executive Housekeeper, Supervisor, Room Attendant, etc.
  
  -- Assignment preferences
  assigned_floors INTEGER[], -- Array of floor numbers
  assigned_sections TEXT[], -- Section names/codes
  max_rooms_per_shift INTEGER DEFAULT 14,
  max_credits_per_shift DECIMAL(5,2) DEFAULT 14.0,
  
  -- Skills and certifications
  skills TEXT[], -- deep_cleaning, vip_service, public_areas, turndown, etc.
  certifications JSONB DEFAULT '[]', -- Array of certification objects
  languages TEXT[] DEFAULT ARRAY['en'],
  
  -- Performance metrics (cached, updated daily)
  avg_cleaning_time_minutes INTEGER,
  quality_score DECIMAL(3,2), -- 0.00 to 5.00
  tasks_completed_today INTEGER DEFAULT 0,
  tasks_completed_month INTEGER DEFAULT 0,
  
  -- Status
  is_available BOOLEAN DEFAULT true,
  current_task_id UUID,
  current_room_number VARCHAR(20),
  last_location_update TIMESTAMP WITH TIME ZONE,
  
  -- Employment details
  hire_date DATE,
  probation_end_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hk_staff_user ON hk_staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_hk_staff_available ON hk_staff_profiles(is_available);

-- Ensure column exists before indexing
ALTER TABLE hk_staff_profiles ADD COLUMN IF NOT EXISTS assigned_floors INTEGER[];

CREATE INDEX IF NOT EXISTS idx_hk_staff_floors ON hk_staff_profiles USING GIN(assigned_floors);

-- =====================================================
-- SECTION 3: ENHANCED ROOMS TABLE
-- =====================================================

-- Add housekeeping-specific columns to rooms if they don't exist
DO $$ BEGIN
  -- Add new columns to existing rooms table
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hk_status hk_room_status DEFAULT 'vacant_dirty';
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS cleaning_priority hk_priority DEFAULT 'normal';
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS assigned_attendant_id UUID REFERENCES hk_staff_profiles(id);
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_cleaned_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_inspected_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_inspected_by UUID REFERENCES hk_staff_profiles(id);
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS next_cleaning_due TIMESTAMP WITH TIME ZONE;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS cleaning_credits DECIMAL(3,1) DEFAULT 1.0;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS guest_preferences JSONB DEFAULT '{}';
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS dnd_start_time TIMESTAMP WITH TIME ZONE;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expected_checkout TIMESTAMP WITH TIME ZONE;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expected_arrival TIMESTAMP WITH TIME ZONE;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_occupancy_id UUID; -- References booking/reservation
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS amenities_checklist JSONB DEFAULT '{}';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Room status history for audit trail
CREATE TABLE IF NOT EXISTS hk_room_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  previous_status hk_room_status,
  new_status hk_room_status NOT NULL,
  changed_by UUID REFERENCES users(id) NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_status_history_room ON hk_room_status_history(room_id);
CREATE INDEX IF NOT EXISTS idx_room_status_history_date ON hk_room_status_history(created_at DESC);

-- =====================================================
-- SECTION 4: ENHANCED HOUSEKEEPING TASKS
-- =====================================================

-- Drop and recreate housekeeping_tasks with enhanced schema
CREATE TABLE IF NOT EXISTS hk_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_number VARCHAR(20) UNIQUE NOT NULL, -- HK-2024-00001
  
  -- Room Information
  room_id UUID REFERENCES rooms(id) NOT NULL,
  room_number VARCHAR(20) NOT NULL, -- Denormalized for quick access
  floor_number INTEGER NOT NULL,
  
  -- Task Details
  task_type hk_task_type NOT NULL,
  priority hk_priority DEFAULT 'normal',
  status hk_task_status DEFAULT 'pending',
  
  -- Assignment
  assigned_to UUID REFERENCES hk_staff_profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  assigned_by UUID REFERENCES users(id),
  
  -- Time Tracking
  estimated_duration_minutes INTEGER DEFAULT 30,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  due_by TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  resumed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  actual_duration_minutes INTEGER,
  
  -- Credits System
  credit_value DECIMAL(3,1) DEFAULT 1.0,
  
  -- Completion Details
  completed_by UUID REFERENCES hk_staff_profiles(id),
  completion_notes TEXT,
  completion_photos TEXT[], -- URLs to photos
  
  -- Inspection
  requires_inspection BOOLEAN DEFAULT true,
  inspection_id UUID, -- Will reference hk_inspections
  
  -- Guest Context
  is_guest_present BOOLEAN DEFAULT false,
  is_vip BOOLEAN DEFAULT false,
  guest_preferences JSONB DEFAULT '{}',
  special_instructions TEXT,
  
  -- Supplies Used
  supplies_used JSONB DEFAULT '[]', -- Array of {supply_id, quantity}
  
  -- Issues
  issues_reported INTEGER DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Rework tracking
  is_rework BOOLEAN DEFAULT false,
  original_task_id UUID REFERENCES hk_tasks(id),
  rework_count INTEGER DEFAULT 0
);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_hk_tasks_room ON hk_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned ON hk_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status ON hk_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_priority ON hk_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_date ON hk_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_due ON hk_tasks(due_by);

-- =====================================================
-- SECTION 5: CLEANING CHECKLISTS
-- =====================================================

-- Checklist templates
CREATE TABLE IF NOT EXISTS hk_checklist_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  task_type hk_task_type NOT NULL,
  room_type VARCHAR(50), -- NULL means applies to all room types
  
  -- Checklist sections
  sections JSONB NOT NULL DEFAULT '[]',
  /* Example structure:
  [
    {
      "section": "Bathroom",
      "items": [
        {"item": "Clean toilet", "required": true, "photo_required": false, "time_estimate": 5},
        {"item": "Clean shower/tub", "required": true, "photo_required": false, "time_estimate": 7}
      ]
    }
  ]
  */
  
  total_estimated_time INTEGER, -- Total estimated time in minutes
  is_active BOOLEAN DEFAULT true,
  branch_id INTEGER REFERENCES branches(id), -- NULL means all branches
  
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task checklist completion tracking
CREATE TABLE IF NOT EXISTS hk_task_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES hk_tasks(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES hk_checklist_templates(id),
  
  -- Completed items
  completed_items JSONB DEFAULT '[]',
  /* Structure:
  [
    {
      "section": "Bathroom",
      "item": "Clean toilet",
      "completed": true,
      "completed_at": "2024-01-15T10:30:00Z",
      "notes": "",
      "photo_url": ""
    }
  ]
  */
  
  completion_percentage DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SECTION 6: INSPECTIONS AND QUALITY CONTROL
-- =====================================================

CREATE TABLE IF NOT EXISTS hk_inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_number VARCHAR(20) UNIQUE NOT NULL, -- INS-2024-00001
  
  -- What's being inspected
  task_id UUID REFERENCES hk_tasks(id),
  room_id UUID REFERENCES rooms(id) NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  
  -- Inspection Type
  inspection_type VARCHAR(50) NOT NULL, -- random, scheduled, post_complaint, pre_arrival_vip, new_staff
  
  -- Scores (0-5 scale)
  cleanliness_score DECIMAL(2,1),
  tidiness_score DECIMAL(2,1),
  bathroom_score DECIMAL(2,1),
  amenities_score DECIMAL(2,1),
  linens_score DECIMAL(2,1),
  maintenance_score DECIMAL(2,1),
  overall_score DECIMAL(2,1),
  
  -- Result
  result hk_inspection_result,
  
  -- Deficiencies
  deficiencies JSONB DEFAULT '[]',
  /* Structure:
  [
    {
      "category": "cleanliness",
      "description": "Dust on nightstand",
      "severity": "minor",
      "photo_url": ""
    }
  ]
  */
  
  -- Photos
  photos TEXT[], -- URLs
  
  -- Inspector
  inspected_by UUID REFERENCES hk_staff_profiles(id) NOT NULL,
  inspected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Notes
  notes TEXT,
  
  -- Follow-up
  requires_rework BOOLEAN DEFAULT false,
  rework_task_id UUID REFERENCES hk_tasks(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS result VARCHAR(20) CHECK (result IN ('passed', 'failed', 'pending'));
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES hk_staff_profiles(id);
CREATE INDEX IF NOT EXISTS idx_hk_inspections_room ON hk_inspections(room_id);
CREATE INDEX IF NOT EXISTS idx_hk_inspections_task ON hk_inspections(task_id);
CREATE INDEX IF NOT EXISTS idx_hk_inspections_inspector ON hk_inspections(inspected_by);
CREATE INDEX IF NOT EXISTS idx_hk_inspections_result ON hk_inspections(result);

-- =====================================================
-- SECTION 7: LINEN MANAGEMENT
-- =====================================================

-- Linen types
CREATE TABLE IF NOT EXISTS hk_linen_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- bed_linen, bath_linen, table_linen, misc
  size VARCHAR(50), -- single, double, queen, king, etc.
  color VARCHAR(50),
  material VARCHAR(100),
  
  -- Lifecycle
  expected_uses INTEGER DEFAULT 100, -- Expected number of uses
  
  -- Par levels per location
  par_level_central INTEGER DEFAULT 0,
  par_level_floor INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Linen inventory
CREATE TABLE IF NOT EXISTS hk_linen_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  linen_type_id UUID REFERENCES hk_linen_types(id) NOT NULL,
  
  -- Batch/lot tracking
  batch_code VARCHAR(50),
  purchase_date DATE,
  
  -- Location
  location_type VARCHAR(50) NOT NULL, -- central_store, floor_pantry, room, laundry
  location_id VARCHAR(100), -- floor number, room number, etc.
  branch_id INTEGER REFERENCES branches(id) NOT NULL,
  
  -- Status
  status hk_linen_status DEFAULT 'clean_available',
  condition VARCHAR(50) DEFAULT 'good', -- new, good, fair, worn
  
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_washed_at TIMESTAMP WITH TIME ZONE,
  
  -- Assignment
  current_room_id UUID REFERENCES rooms(id),
  assigned_to_cart UUID, -- Cart/trolley ID
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hk_linen_type ON hk_linen_inventory(linen_type_id);
CREATE INDEX IF NOT EXISTS idx_hk_linen_status ON hk_linen_inventory(status);
CREATE INDEX IF NOT EXISTS idx_hk_linen_location ON hk_linen_inventory(location_type, location_id);

-- Linen transactions
CREATE TABLE IF NOT EXISTS hk_linen_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  linen_type_id UUID REFERENCES hk_linen_types(id) NOT NULL,
  
  transaction_type VARCHAR(50) NOT NULL, -- issue, return, receive, wash, retire, damage
  quantity INTEGER NOT NULL,
  
  -- From/To
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  
  -- Related entities
  task_id UUID REFERENCES hk_tasks(id),
  room_id UUID REFERENCES rooms(id),
  staff_id UUID REFERENCES hk_staff_profiles(id),
  
  notes TEXT,
  
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SECTION 8: LOST AND FOUND
-- =====================================================

CREATE TABLE IF NOT EXISTS hk_lost_found (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_number VARCHAR(20) UNIQUE NOT NULL, -- LF-2024-00001
  
  -- Item details
  item_description TEXT NOT NULL,
  item_category VARCHAR(100) NOT NULL, -- electronics, clothing, documents, jewelry, luggage, misc
  estimated_value DECIMAL(10,2),
  is_valuable BOOLEAN DEFAULT false,
  
  -- Location found
  found_location VARCHAR(100) NOT NULL, -- room number, public area name
  room_id UUID REFERENCES rooms(id),
  floor_number INTEGER,
  
  -- Photos
  photos TEXT[],
  
  -- Found by
  found_by UUID REFERENCES hk_staff_profiles(id) NOT NULL,
  found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Status
  status hk_lost_found_status DEFAULT 'found',
  
  -- Storage
  storage_location VARCHAR(200),
  storage_bin VARCHAR(50),
  
  -- Guest matching
  potential_guest_id UUID, -- References guests/bookings
  guest_name VARCHAR(200),
  guest_contact VARCHAR(200),
  
  -- Contact attempts
  contact_attempts JSONB DEFAULT '[]',
  /* Structure:
  [
    {
      "date": "2024-01-15",
      "method": "phone",
      "result": "no_answer",
      "notes": ""
    }
  ]
  */
  
  -- Resolution
  claimed_by VARCHAR(200),
  claimed_at TIMESTAMP WITH TIME ZONE,
  claimed_signature TEXT, -- Base64 or URL
  returned_by UUID REFERENCES users(id),
  
  -- Disposal
  disposal_date DATE,
  disposal_method VARCHAR(100), -- donated, discarded, staff_purchase
  disposal_notes TEXT,
  
  -- Retention
  retention_days INTEGER DEFAULT 90,
  retention_end_date DATE,
  
  branch_id INTEGER REFERENCES branches(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hk_lost_found_status ON hk_lost_found(status);
CREATE INDEX IF NOT EXISTS idx_hk_lost_found_date ON hk_lost_found(found_at DESC);
ALTER TABLE hk_lost_found ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);
CREATE INDEX IF NOT EXISTS idx_hk_lost_found_room ON hk_lost_found(room_id);

-- =====================================================
-- SECTION 9: MAINTENANCE REQUESTS FROM HOUSEKEEPING
-- =====================================================

CREATE TABLE IF NOT EXISTS hk_maintenance_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number VARCHAR(20) UNIQUE NOT NULL, -- MR-2024-00001
  
  -- Location
  room_id UUID REFERENCES rooms(id),
  room_number VARCHAR(20),
  location_description TEXT, -- For non-room locations
  
  -- Issue details
  category VARCHAR(100) NOT NULL, -- plumbing, electrical, hvac, furniture, equipment, structural, other
  subcategory VARCHAR(100),
  description TEXT NOT NULL,
  
  -- Priority and urgency
  priority hk_priority DEFAULT 'normal',
  is_safety_issue BOOLEAN DEFAULT false,
  impacts_room_availability BOOLEAN DEFAULT true,
  
  -- Photos
  photos TEXT[],
  
  -- Reported by
  reported_by UUID REFERENCES hk_staff_profiles(id) NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Status
  status hk_maintenance_status DEFAULT 'submitted',
  
  -- Assignment (to maintenance team)
  assigned_to UUID, -- Maintenance staff ID
  assigned_at TIMESTAMP WITH TIME ZONE,
  
  -- Resolution
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  resolution_notes TEXT,
  resolution_photos TEXT[],
  
  -- Verification
  verified_by UUID REFERENCES hk_staff_profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- SLA tracking
  sla_due_at TIMESTAMP WITH TIME ZONE,
  sla_breached BOOLEAN DEFAULT false,
  
  branch_id INTEGER REFERENCES branches(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hk_maint_status ON hk_maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_hk_maint_room ON hk_maintenance_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_hk_maint_priority ON hk_maintenance_requests(priority);

-- =====================================================
-- SECTION 10: GUEST SPECIAL REQUESTS
-- =====================================================

CREATE TABLE IF NOT EXISTS hk_guest_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number VARCHAR(20) UNIQUE NOT NULL, -- GR-2024-00001
  
  -- Room and guest
  room_id UUID REFERENCES rooms(id) NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  guest_name VARCHAR(200),
  booking_id UUID, -- References booking system
  
  -- Request details
  request_type VARCHAR(100) NOT NULL, -- extra_amenities, linen_change, room_fragrance, turndown_time, etc.
  description TEXT NOT NULL,
  
  -- Specifics
  items_requested JSONB DEFAULT '[]',
  /* Structure:
  [
    {"item": "Extra pillows", "quantity": 2},
    {"item": "Hypoallergenic sheets", "quantity": 1}
  ]
  */
  
  preferred_time TIME,
  preferred_date DATE,
  
  -- Priority
  priority hk_priority DEFAULT 'normal',
  is_vip BOOLEAN DEFAULT false,
  
  -- Source
  source VARCHAR(50) NOT NULL, -- front_desk, guest_app, phone, in_room
  received_by UUID REFERENCES users(id),
  
  -- Status
  status hk_task_status DEFAULT 'pending',
  
  -- Assignment
  assigned_to UUID REFERENCES hk_staff_profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  
  -- Completion
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES hk_staff_profiles(id),
  completion_notes TEXT,
  
  -- Feedback
  guest_satisfied BOOLEAN,
  guest_feedback TEXT,
  
  branch_id INTEGER REFERENCES branches(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hk_guest_req_room ON hk_guest_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_hk_guest_req_status ON hk_guest_requests(status);

-- =====================================================
-- SECTION 11: STAFF SCHEDULING
-- =====================================================

-- Shift definitions
CREATE TABLE IF NOT EXISTS hk_shift_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  shift_type hk_shift_type NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_minutes INTEGER DEFAULT 30,
  
  -- Applicable days
  monday BOOLEAN DEFAULT true,
  tuesday BOOLEAN DEFAULT true,
  wednesday BOOLEAN DEFAULT true,
  thursday BOOLEAN DEFAULT true,
  friday BOOLEAN DEFAULT true,
  saturday BOOLEAN DEFAULT true,
  sunday BOOLEAN DEFAULT true,
  
  is_active BOOLEAN DEFAULT true,
  branch_id INTEGER REFERENCES branches(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff schedules
CREATE TABLE IF NOT EXISTS hk_staff_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES hk_staff_profiles(id) NOT NULL,
  shift_id UUID REFERENCES hk_shift_definitions(id) NOT NULL,
  
  schedule_date DATE NOT NULL,
  
  -- Override times
  actual_start_time TIME,
  actual_end_time TIME,
  
  -- Assigned areas
  assigned_floors INTEGER[],
  assigned_sections TEXT[],
  
  -- Status
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, confirmed, checked_in, checked_out, absent, sick_leave
  
  -- Time tracking
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  break_start_time TIMESTAMP WITH TIME ZONE,
  break_end_time TIMESTAMP WITH TIME ZONE,
  
  -- Overtime
  is_overtime BOOLEAN DEFAULT false,
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  overtime_approved_by UUID REFERENCES users(id),
  
  notes TEXT,
  
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(staff_id, schedule_date, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_hk_schedule_staff ON hk_staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_hk_schedule_date ON hk_staff_schedules(schedule_date);

-- Leave requests
CREATE TABLE IF NOT EXISTS hk_leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES hk_staff_profiles(id) NOT NULL,
  
  leave_type VARCHAR(50) NOT NULL, -- annual, sick, personal, emergency
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  reason TEXT,
  
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, cancelled
  
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shift swap requests
CREATE TABLE IF NOT EXISTS hk_shift_swaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  requester_id UUID REFERENCES hk_staff_profiles(id) NOT NULL,
  requester_schedule_id UUID REFERENCES hk_staff_schedules(id) NOT NULL,
  
  target_id UUID REFERENCES hk_staff_profiles(id) NOT NULL,
  target_schedule_id UUID REFERENCES hk_staff_schedules(id) NOT NULL,
  
  reason TEXT,
  
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, rejected, approved, cancelled
  
  -- Staff acceptance
  accepted_by_target BOOLEAN,
  target_response_at TIMESTAMP WITH TIME ZONE,
  
  -- Manager approval
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SECTION 12: PERFORMANCE METRICS
-- =====================================================

-- Daily performance snapshots
CREATE TABLE IF NOT EXISTS hk_daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  branch_id INTEGER REFERENCES branches(id) NOT NULL,
  
  -- Task metrics
  total_tasks_created INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  total_tasks_pending INTEGER DEFAULT 0,
  
  -- Room metrics
  total_rooms INTEGER DEFAULT 0,
  rooms_cleaned INTEGER DEFAULT 0,
  rooms_inspected INTEGER DEFAULT 0,
  rooms_out_of_order INTEGER DEFAULT 0,
  
  -- Quality metrics
  inspections_passed INTEGER DEFAULT 0,
  inspections_failed INTEGER DEFAULT 0,
  avg_quality_score DECIMAL(3,2),
  
  -- Time metrics
  avg_checkout_clean_time INTEGER, -- minutes
  avg_stayover_clean_time INTEGER, -- minutes
  
  -- Staff metrics
  staff_scheduled INTEGER DEFAULT 0,
  staff_present INTEGER DEFAULT 0,
  
  -- Guest satisfaction
  guest_complaints INTEGER DEFAULT 0,
  guest_compliments INTEGER DEFAULT 0,
  
  -- Supply metrics
  low_stock_items INTEGER DEFAULT 0,
  critical_stock_items INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(metric_date, branch_id)
);

-- Staff performance metrics (daily)
CREATE TABLE IF NOT EXISTS hk_staff_daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES hk_staff_profiles(id) NOT NULL,
  metric_date DATE NOT NULL,
  
  -- Tasks
  tasks_assigned INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_rework INTEGER DEFAULT 0,
  
  -- Time
  total_cleaning_time_minutes INTEGER DEFAULT 0,
  avg_cleaning_time_minutes INTEGER,
  
  -- Credits
  credits_earned DECIMAL(5,2) DEFAULT 0,
  
  -- Quality
  inspections_passed INTEGER DEFAULT 0,
  inspections_failed INTEGER DEFAULT 0,
  avg_quality_score DECIMAL(3,2),
  
  -- Attendance
  shift_start_time TIMESTAMP WITH TIME ZONE,
  shift_end_time TIMESTAMP WITH TIME ZONE,
  break_duration_minutes INTEGER DEFAULT 0,
  was_on_time BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(staff_id, metric_date)
);

-- =====================================================
-- SECTION 13: SUPPLY MANAGEMENT (ENHANCED)
-- =====================================================

-- Floor pantry inventory
CREATE TABLE IF NOT EXISTS hk_floor_pantry_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  floor_number INTEGER NOT NULL,
  branch_id INTEGER REFERENCES branches(id) NOT NULL,
  
  supply_id UUID NOT NULL, -- References housekeeping_supplies
  current_quantity INTEGER DEFAULT 0,
  par_level INTEGER DEFAULT 0,
  
  last_restocked_at TIMESTAMP WITH TIME ZONE,
  last_restocked_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(floor_number, branch_id, supply_id)
);

-- Cart/trolley inventory
CREATE TABLE IF NOT EXISTS hk_cart_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_code VARCHAR(50) NOT NULL, -- CART-F1-01
  assigned_to UUID REFERENCES hk_staff_profiles(id),
  
  -- Inventory snapshot
  inventory_items JSONB DEFAULT '[]',
  /* Structure:
  [
    {"supply_id": "uuid", "quantity": 10, "par_level": 20}
  ]
  */
  
  last_loaded_at TIMESTAMP WITH TIME ZONE,
  last_loaded_by UUID REFERENCES users(id),
  
  branch_id INTEGER REFERENCES branches(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SECTION 14: TRIGGERS AND FUNCTIONS
-- =====================================================


-- FIXES FOR MISSING COLUMNS
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS inspection_number VARCHAR(50);
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS task_number VARCHAR(50);
ALTER TABLE hk_lost_found ADD COLUMN IF NOT EXISTS item_number VARCHAR(50);
ALTER TABLE hk_maintenance_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);


-- FIXES FOR MISSING COLUMNS
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS inspection_number VARCHAR(50);
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS task_number VARCHAR(50);
ALTER TABLE hk_lost_found ADD COLUMN IF NOT EXISTS item_number VARCHAR(50);
ALTER TABLE hk_maintenance_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);


-- FIXES FOR MISSING COLUMNS
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS inspection_number VARCHAR(50);
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS task_number VARCHAR(50);
ALTER TABLE hk_lost_found ADD COLUMN IF NOT EXISTS item_number VARCHAR(50);
ALTER TABLE hk_maintenance_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '[]';
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS total_estimated_time INTEGER;


-- FIXES FOR MISSING COLUMNS
ALTER TABLE hk_inspections ADD COLUMN IF NOT EXISTS inspection_number VARCHAR(50);
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS task_number VARCHAR(50);
ALTER TABLE hk_lost_found ADD COLUMN IF NOT EXISTS item_number VARCHAR(50);
ALTER TABLE hk_maintenance_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '[]';
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS total_estimated_time INTEGER;
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE hk_checklist_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Function to generate task numbers
CREATE OR REPLACE FUNCTION generate_hk_task_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.task_number := 'HK-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
    LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(task_number FROM 'HK-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 
       FROM hk_tasks 
       WHERE task_number LIKE 'HK-' || TO_CHAR(NOW(), 'YYYY') || '-%')::TEXT, 
      5, '0'
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for task numbers
DROP TRIGGER IF EXISTS set_hk_task_number ON hk_tasks;
CREATE TRIGGER set_hk_task_number
  BEFORE INSERT ON hk_tasks
  FOR EACH ROW
  WHEN (NEW.task_number IS NULL)
  EXECUTE FUNCTION generate_hk_task_number();

-- Function to generate inspection numbers
CREATE OR REPLACE FUNCTION generate_hk_inspection_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.inspection_number := 'INS-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
    LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(inspection_number FROM 'INS-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 
       FROM hk_inspections 
       WHERE inspection_number LIKE 'INS-' || TO_CHAR(NOW(), 'YYYY') || '-%')::TEXT, 
      5, '0'
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_hk_inspection_number ON hk_inspections;
CREATE TRIGGER set_hk_inspection_number
  BEFORE INSERT ON hk_inspections
  FOR EACH ROW
  WHEN (NEW.inspection_number IS NULL)
  EXECUTE FUNCTION generate_hk_inspection_number();

-- Function to generate lost & found numbers
CREATE OR REPLACE FUNCTION generate_hk_lost_found_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.item_number := 'LF-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
    LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(item_number FROM 'LF-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 
       FROM hk_lost_found 
       WHERE item_number LIKE 'LF-' || TO_CHAR(NOW(), 'YYYY') || '-%')::TEXT, 
      5, '0'
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_hk_lost_found_number ON hk_lost_found;
CREATE TRIGGER set_hk_lost_found_number
  BEFORE INSERT ON hk_lost_found
  FOR EACH ROW
  WHEN (NEW.item_number IS NULL)
  EXECUTE FUNCTION generate_hk_lost_found_number();

-- Function to generate maintenance request numbers
CREATE OR REPLACE FUNCTION generate_hk_maintenance_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'MR-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
    LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 'MR-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 
       FROM hk_maintenance_requests 
       WHERE request_number LIKE 'MR-' || TO_CHAR(NOW(), 'YYYY') || '-%')::TEXT, 
      5, '0'
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_hk_maintenance_number ON hk_maintenance_requests;
CREATE TRIGGER set_hk_maintenance_number
  BEFORE INSERT ON hk_maintenance_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL)
  EXECUTE FUNCTION generate_hk_maintenance_number();

-- Function to generate guest request numbers
CREATE OR REPLACE FUNCTION generate_hk_guest_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'GR-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
    LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 'GR-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 
       FROM hk_guest_requests 
       WHERE request_number LIKE 'GR-' || TO_CHAR(NOW(), 'YYYY') || '-%')::TEXT, 
      5, '0'
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_hk_guest_request_number ON hk_guest_requests;
CREATE TRIGGER set_hk_guest_request_number
  BEFORE INSERT ON hk_guest_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL)
  EXECUTE FUNCTION generate_hk_guest_request_number();

-- Function to log room status changes
CREATE OR REPLACE FUNCTION log_room_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.hk_status IS DISTINCT FROM NEW.hk_status THEN
    INSERT INTO hk_room_status_history (room_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.hk_status, NEW.hk_status, COALESCE(current_setting('app.current_user_id', true)::UUID, NULL));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_hk_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers
CREATE TRIGGER update_hk_tasks_timestamp BEFORE UPDATE ON hk_tasks FOR EACH ROW EXECUTE FUNCTION update_hk_timestamp();
CREATE TRIGGER update_hk_staff_timestamp BEFORE UPDATE ON hk_staff_profiles FOR EACH ROW EXECUTE FUNCTION update_hk_timestamp();
CREATE TRIGGER update_hk_lost_found_timestamp BEFORE UPDATE ON hk_lost_found FOR EACH ROW EXECUTE FUNCTION update_hk_timestamp();
CREATE TRIGGER update_hk_maintenance_timestamp BEFORE UPDATE ON hk_maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_hk_timestamp();
CREATE TRIGGER update_hk_guest_req_timestamp BEFORE UPDATE ON hk_guest_requests FOR EACH ROW EXECUTE FUNCTION update_hk_timestamp();
CREATE TRIGGER update_hk_schedules_timestamp BEFORE UPDATE ON hk_staff_schedules FOR EACH ROW EXECUTE FUNCTION update_hk_timestamp();

-- =====================================================
-- SECTION 15: ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE hk_staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_room_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_linen_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_linen_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_linen_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_lost_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_guest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_staff_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_floor_pantry_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_cart_inventory ENABLE ROW LEVEL SECURITY;

-- Create policies for managers and admins (full access)
CREATE POLICY "Managers full access to hk_tasks" ON hk_tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'branch_manager'))
);

CREATE POLICY "Managers full access to hk_staff_profiles" ON hk_staff_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'branch_manager'))
);

-- Staff can view their own tasks
CREATE POLICY "Staff view own tasks" ON hk_tasks FOR SELECT USING (
  assigned_to IN (SELECT id FROM hk_staff_profiles WHERE user_id = auth.uid())
);

-- Staff can update their own tasks (status changes)
CREATE POLICY "Staff update own tasks" ON hk_tasks FOR UPDATE USING (
  assigned_to IN (SELECT id FROM hk_staff_profiles WHERE user_id = auth.uid())
);

-- All housekeeping staff can view rooms
CREATE POLICY "Staff view room history" ON hk_room_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'branch_manager', 'housekeeping'))
);

-- =====================================================
-- SECTION 16: DEFAULT DATA
-- =====================================================

-- Insert default shift definitions
INSERT INTO hk_shift_definitions (name, shift_type, start_time, end_time, break_duration_minutes)
VALUES 
  ('Morning Shift', 'morning', '06:00', '14:00', 30),
  ('Afternoon Shift', 'afternoon', '14:00', '22:00', 30),
  ('Evening/Turndown', 'evening', '18:00', '22:00', 15),
  ('Night Shift', 'night', '22:00', '06:00', 30)
ON CONFLICT DO NOTHING;

-- Insert default checklist templates
INSERT INTO hk_checklist_templates (name, task_type, sections, total_estimated_time, created_by)
SELECT 
  'Standard Checkout Clean',
  'checkout_full_clean',
  '[
    {
      "section": "Bathroom",
      "items": [
        {"item": "Clean and disinfect toilet", "required": true, "time_estimate": 5},
        {"item": "Clean shower/bathtub", "required": true, "time_estimate": 7},
        {"item": "Clean sink and counter", "required": true, "time_estimate": 3},
        {"item": "Clean mirrors", "required": true, "time_estimate": 2},
        {"item": "Replace towels", "required": true, "time_estimate": 2},
        {"item": "Restock toiletries", "required": true, "time_estimate": 3},
        {"item": "Empty trash", "required": true, "time_estimate": 1},
        {"item": "Mop floor", "required": true, "time_estimate": 3}
      ]
    },
    {
      "section": "Bedroom",
      "items": [
        {"item": "Strip and remake bed", "required": true, "time_estimate": 10},
        {"item": "Dust all surfaces", "required": true, "time_estimate": 5},
        {"item": "Clean nightstands", "required": true, "time_estimate": 2},
        {"item": "Vacuum floor", "required": true, "time_estimate": 5},
        {"item": "Check under bed", "required": true, "time_estimate": 1},
        {"item": "Arrange pillows and cushions", "required": true, "time_estimate": 2}
      ]
    },
    {
      "section": "General",
      "items": [
        {"item": "Check TV and remote", "required": true, "time_estimate": 1},
        {"item": "Check lights work", "required": true, "time_estimate": 1},
        {"item": "Clean windows (inside)", "required": false, "time_estimate": 3},
        {"item": "Restock minibar", "required": false, "time_estimate": 2},
        {"item": "Check A/C settings", "required": true, "time_estimate": 1},
        {"item": "Final walkthrough", "required": true, "time_estimate": 2}
      ]
    }
  ]'::JSONB,
  45,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM hk_checklist_templates WHERE name = 'Standard Checkout Clean');

-- Insert linen types
INSERT INTO hk_linen_types (name, category, size, par_level_central, par_level_floor)
VALUES 
  ('Bed Sheet Single', 'bed_linen', 'single', 100, 20),
  ('Bed Sheet Double', 'bed_linen', 'double', 150, 30),
  ('Bed Sheet Queen', 'bed_linen', 'queen', 200, 40),
  ('Bed Sheet King', 'bed_linen', 'king', 100, 20),
  ('Pillowcase Standard', 'bed_linen', 'standard', 300, 60),
  ('Duvet Cover Single', 'bed_linen', 'single', 50, 10),
  ('Duvet Cover Double', 'bed_linen', 'double', 75, 15),
  ('Bath Towel', 'bath_linen', 'standard', 400, 80),
  ('Hand Towel', 'bath_linen', 'standard', 400, 80),
  ('Face Towel', 'bath_linen', 'standard', 400, 80),
  ('Bath Mat', 'bath_linen', 'standard', 200, 40),
  ('Bathrobe', 'bath_linen', 'standard', 100, 20)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SECTION 17: VIEWS FOR REPORTING
-- =====================================================

-- Room status overview view
DROP VIEW IF EXISTS vw_hk_room_status_overview CASCADE;
CREATE OR REPLACE VIEW vw_hk_room_status_overview AS
SELECT 
  r.id,
  r.room_number,
  r.floor,
  r.room_type,
  r.hk_status,
  r.cleaning_priority,
  r.is_vip,
  r.last_cleaned_at,
  r.last_inspected_at,
  sp.id as assigned_attendant_id,
  u.first_name || ' ' || u.last_name as assigned_attendant_name,
  t.id as current_task_id,
  t.status as current_task_status,
  t.started_at as task_started_at,
  r.branch_id
FROM rooms r
LEFT JOIN hk_staff_profiles sp ON r.assigned_attendant_id = sp.id
LEFT JOIN users u ON sp.user_id = u.id
LEFT JOIN hk_tasks t ON t.room_id = r.id AND t.status NOT IN ('completed', 'cancelled', 'inspection_passed');

-- Staff workload view
DROP VIEW IF EXISTS vw_hk_staff_workload CASCADE;
CREATE OR REPLACE VIEW vw_hk_staff_workload AS
SELECT 
  sp.id,
  sp.staff_code,
  u.first_name || ' ' || u.last_name as staff_name,
  sp.designation,
  sp.is_available,
  sp.current_task_id,
  sp.current_room_number,
  sp.max_rooms_per_shift,
  sp.max_credits_per_shift,
  COUNT(CASE WHEN t.status IN ('assigned', 'in_progress') THEN 1 END) as active_tasks,
  COUNT(CASE WHEN t.status = 'completed' AND DATE(t.completed_at) = CURRENT_DATE THEN 1 END) as completed_today,
  COALESCE(SUM(CASE WHEN t.status IN ('assigned', 'in_progress') THEN t.credit_value END), 0) as current_credits,
  sp.quality_score
FROM hk_staff_profiles sp
JOIN users u ON sp.user_id = u.id
LEFT JOIN hk_tasks t ON t.assigned_to = sp.id AND DATE(t.created_at) = CURRENT_DATE
GROUP BY sp.id, sp.staff_code, u.first_name, u.last_name, sp.designation, 
         sp.is_available, sp.current_task_id, sp.current_room_number,
         sp.max_rooms_per_shift, sp.max_credits_per_shift, sp.quality_score;

-- Daily summary view
DROP VIEW IF EXISTS vw_hk_daily_summary CASCADE;
CREATE OR REPLACE VIEW vw_hk_daily_summary AS
SELECT 
  CURRENT_DATE as summary_date,
  COUNT(DISTINCT r.id) as total_rooms,
  COUNT(DISTINCT CASE WHEN r.hk_status = 'vacant_clean' THEN r.id END) as vacant_clean,
  COUNT(DISTINCT CASE WHEN r.hk_status = 'vacant_dirty' THEN r.id END) as vacant_dirty,
  COUNT(DISTINCT CASE WHEN r.hk_status = 'checkout' THEN r.id END) as checkouts,
  COUNT(DISTINCT CASE WHEN r.hk_status = 'cleaning_in_progress' THEN r.id END) as cleaning_in_progress,
  COUNT(DISTINCT CASE WHEN r.hk_status = 'out_of_order' THEN r.id END) as out_of_order,
  COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) as pending_tasks,
  COUNT(DISTINCT CASE WHEN t.status IN ('assigned', 'in_progress') THEN t.id END) as active_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'completed' AND DATE(t.completed_at) = CURRENT_DATE THEN t.id END) as completed_tasks,
  COUNT(DISTINCT CASE WHEN t.priority IN ('critical', 'urgent') AND t.status NOT IN ('completed', 'cancelled') THEN t.id END) as urgent_pending,
  r.branch_id
FROM rooms r
LEFT JOIN hk_tasks t ON t.room_id = r.id AND DATE(t.created_at) = CURRENT_DATE
GROUP BY r.branch_id;

COMMENT ON TABLE hk_tasks IS 'Enhanced housekeeping tasks with full workflow tracking';
COMMENT ON TABLE hk_staff_profiles IS 'Housekeeping staff profiles with skills and performance metrics';
COMMENT ON TABLE hk_inspections IS 'Room inspection records with quality scores';
COMMENT ON TABLE hk_lost_found IS 'Lost and found item tracking';
COMMENT ON TABLE hk_maintenance_requests IS 'Maintenance requests submitted by housekeeping';
COMMENT ON TABLE hk_guest_requests IS 'Special guest requests for housekeeping';
COMMENT ON TABLE hk_staff_schedules IS 'Staff scheduling and time tracking';
