-- 20251203_enhance_branches_schema.sql
-- Enhances the branch system for a robust multi-branch architecture

-- Backup the existing data if needed
CREATE TABLE IF NOT EXISTS branches_backup AS SELECT * FROM branches;

-- Enhance the branches table with additional fields
ALTER TABLE branches 
  ADD COLUMN IF NOT EXISTS branch_type VARCHAR(50) DEFAULT 'hotel',
  ADD COLUMN IF NOT EXISTS number_of_rooms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS opening_date DATE;

-- Update the status field to include more statuses
ALTER TABLE branches 
  DROP CONSTRAINT IF EXISTS branches_status_check;

ALTER TABLE branches
  ADD CONSTRAINT branches_status_check 
  CHECK (status IN ('active', 'inactive', 'under_maintenance', 'under_renovation', 'coming_soon', 'closed'));

-- Create branch access control table
CREATE TABLE IF NOT EXISTS user_branch_access (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  access_level VARCHAR(20) CHECK (access_level IN ('full', 'read_only', 'limited')) DEFAULT 'full',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, branch_id)
);

-- Create inter-branch transfers table
CREATE TABLE IF NOT EXISTS inter_branch_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number VARCHAR(50) UNIQUE,
  from_branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  to_branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  transfer_type VARCHAR(20) CHECK (transfer_type IN ('stock', 'staff', 'equipment', 'vehicle')),
  status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected', 'in_transit', 'completed', 'cancelled')),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  items JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create branch configuration settings table
CREATE TABLE IF NOT EXISTS branch_settings (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  is_overridden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(branch_id, setting_key)
);

-- Create branch feature flags table
CREATE TABLE IF NOT EXISTS branch_features (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(branch_id, feature_name)
);

-- Add branch_id column to all relevant tables if not already exists
-- Note: In a real migration, you'd have to check each table and add the column if needed

-- Example function to add branch_id to a table if it doesn't exist
CREATE OR REPLACE FUNCTION add_branch_id_if_not_exists(input_table_name text) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = input_table_name 
        AND column_name = 'branch_id'
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL', input_table_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add branch_id to tables that exist in our base schema
-- We'll skip this step for now since our base schema already includes branch_id where needed

-- Create roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Add enhanced roles to the roles table
INSERT INTO roles (role_name, description, permissions, created_at)
VALUES 
  ('branch_operations_manager', 'Manages all branch operations including inventory and staff', 
   '{"inventory": {"read": true, "write": true}, "staff": {"read": true, "write": true}, "finances": {"read": true, "write": false}}', NOW()),
  ('central_operations_manager', 'Manages central operations and oversees all branches', 
   '{"inventory": {"read": true, "write": true}, "branches": {"read": true, "write": true}, "finances": {"read": true, "write": true}}', NOW()),
  ('facilities_manager', 'Manages housekeeping and maintenance operations', 
   '{"housekeeping": {"read": true, "write": true}, "maintenance": {"read": true, "write": true}}', NOW())
ON CONFLICT (role_name) DO NOTHING;

-- Create a transfer number generation function
CREATE OR REPLACE FUNCTION generate_transfer_number() RETURNS text AS $$
DECLARE
  _date text;
  _count int;
  _transfer_number text;
BEGIN
  _date := to_char(now(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO _count FROM inter_branch_transfers WHERE transfer_number LIKE 'TRF-' || _date || '-%';
  _transfer_number := 'TRF-' || _date || '-' || lpad(_count::text, 3, '0');
  RETURN _transfer_number;
END;
$$ LANGUAGE plpgsql;
