-- Core organizational, fleet, finance, and audit tables for Kyogong
-- This migration is designed to be additive and non-breaking.

-- =========================
-- 1. Roles & Permissions
-- =========================

-- Roles table: metadata around the existing user_role enum
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  role_name user_role UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Permissions table: optional fine-grained permissions per module
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  module VARCHAR(50) NOT NULL,
  can_create BOOLEAN DEFAULT FALSE,
  can_read   BOOLEAN DEFAULT TRUE,
  can_update BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, module)
);


-- =========================
-- 2. Branches & Departments
-- =========================

-- Branches lookup table (does not replace existing branch_enum usages yet)
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  location VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  manager_id UUID REFERENCES users(id),
  is_main_branch BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, closed, maintenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Departments lookup table
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) UNIQUE,
  supervisor_id UUID REFERENCES users(id),
  budget_allocated DECIMAL(12,2),
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);


-- =========================
-- 3. Attendance (Staff)
-- =========================

-- Detailed daily attendance per staff profile
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  attendance_date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'present', -- present, absent, late, half_day, leave, holiday
  shift_type VARCHAR(20), -- morning, afternoon, evening, night
  overtime_hours INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ,
  UNIQUE(staff_id, attendance_date)
);


-- =========================
-- 4. Fleet Management
-- =========================

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  vehicle_number VARCHAR(20) UNIQUE NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL, -- Van, Truck, Car, etc.
  capacity VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'available', -- available, in_use, maintenance, retired
  last_service_date DATE,
  next_service_date DATE,
  current_mileage INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Vehicle assignments table
CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES users(id),
  transfer_id INTEGER REFERENCES stock_transfers(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  start_mileage INTEGER,
  end_mileage INTEGER,
  fuel_used DECIMAL(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================
-- 5. Budgets & Expenses
-- =========================

-- Budgets table by branch/department/category
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL, -- inventory, maintenance, salaries, utilities, etc.
  fiscal_year INTEGER NOT NULL,
  fiscal_month INTEGER, -- 1-12, optional for yearly budgets
  allocated_amount DECIMAL(12,2) NOT NULL,
  spent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Expenses table for operational spending
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  expense_date DATE NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  approved_by UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);


-- =========================
-- 6. Audit Logs
-- =========================

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- create, update, delete, approve, etc.
  table_name VARCHAR(50) NOT NULL,
  record_id TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
