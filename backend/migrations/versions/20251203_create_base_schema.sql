-- Create base schema for Famous Gate Hotel Management System
-- This migration creates the foundational tables required before running the branch enhancement scripts

-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  branch_id INTEGER,
  is_central BOOLEAN DEFAULT FALSE,
  department VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create basic branches table if not exists
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  location VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  is_main_branch BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create basic staff_profiles table if not exists
CREATE TABLE IF NOT EXISTS staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER,
  department VARCHAR(100) NOT NULL,
  position VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  hire_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create stock_levels table if not exists
CREATE TABLE IF NOT EXISTS stock_levels (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER,
  item_sku VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(branch_id, item_sku)
);

-- Create inventory_items table if not exists
CREATE TABLE IF NOT EXISTS inventory_items (
  sku VARCHAR(50) PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  unit_of_measure VARCHAR(20) DEFAULT 'piece',
  cost_price DECIMAL(10,2),
  retail_price DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create stock_requests table if not exists
CREATE TABLE IF NOT EXISTS stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(20) UNIQUE NOT NULL,
  branch_id INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'normal',
  request_type VARCHAR(20) DEFAULT 'standard',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

-- Create stock_request_items table if not exists
CREATE TABLE IF NOT EXISTS stock_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_request_id UUID REFERENCES stock_requests(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) REFERENCES inventory_items(sku),
  requested_quantity INTEGER NOT NULL,
  approved_quantity INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create dispatch_notes table if not exists
CREATE TABLE IF NOT EXISTS dispatch_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number VARCHAR(20) UNIQUE NOT NULL,
  stock_request_id UUID REFERENCES stock_requests(id),
  from_branch_id INTEGER,
  to_branch_id INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  vehicle_number VARCHAR(20),
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),
  estimated_delivery TIMESTAMPTZ,
  dispatch_notes TEXT,
  created_by UUID REFERENCES users(id),
  dispatcher_id UUID REFERENCES users(id),
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create dispatch_items table if not exists
CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES dispatch_notes(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) REFERENCES inventory_items(sku),
  dispatched_quantity INTEGER NOT NULL,
  received_quantity INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Insert initial branches
INSERT INTO branches (name, code, location, is_main_branch, status)
VALUES 
  ('Famous Gate Bomet', 'FGBOMET', 'Bomet', TRUE, 'active'),
  ('Famous Gate Kericho', 'FGKRCHO', 'Kericho', FALSE, 'active'),
  ('Famous Gate Litein', 'FGLITEIN', 'Litein', FALSE, 'active')
ON CONFLICT (code) DO NOTHING;
