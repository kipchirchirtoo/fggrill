-- Create maintenance schema

-- Create maintenance_assets table
CREATE TABLE IF NOT EXISTS maintenance_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  serial_number VARCHAR(100),
  model_number VARCHAR(100),
  manufacturer VARCHAR(100),
  location VARCHAR(100),
  purchase_date DATE,
  warranty_expiry DATE,
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, maintenance, retired
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  updated_by_id UUID REFERENCES users(id)
);

-- Create maintenance_tasks table
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number VARCHAR(20) UNIQUE, -- Auto-generated or managed by app
  type VARCHAR(20) DEFAULT 'corrective', -- corrective, preventive, emergency, inspection
  priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
  status VARCHAR(20) DEFAULT 'pending', -- pending, assigned, in-progress, on-hold, completed, cancelled, verified
  title VARCHAR(200) NOT NULL,
  asset_id UUID REFERENCES maintenance_assets(id),
  location VARCHAR(100),
  description TEXT,
  reported_by_id UUID REFERENCES users(id),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to_id UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  verified_by_id UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  estimated_duration INTEGER, -- in minutes
  actual_duration INTEGER, -- in minutes
  labor_cost DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) DEFAULT 0,
  photos TEXT[], -- Array of photo URLs
  notes TEXT,
  checklist JSONB, -- Flexible checklist data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create maintenance_issues table (for quick reporting)
CREATE TABLE IF NOT EXISTS maintenance_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  location VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'pending', -- pending, resolved, converted_to_task
  reported_by_id UUID REFERENCES users(id),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_by_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  task_id UUID REFERENCES maintenance_tasks(id), -- If converted to a task
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create maintenance_tools table
CREATE TABLE IF NOT EXISTS maintenance_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  serial_number VARCHAR(100),
  status VARCHAR(20) DEFAULT 'available', -- available, in_use, maintenance, lost
  last_checked TIMESTAMPTZ,
  checked_by_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create maintenance_part_usage table
CREATE TABLE IF NOT EXISTS maintenance_part_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  part_name VARCHAR(100) NOT NULL, -- Or link to inventory if available
  quantity INTEGER NOT NULL,
  cost_per_unit DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  used_by_id UUID REFERENCES users(id),
  used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create maintenance_task_history table
CREATE TABLE IF NOT EXISTS maintenance_task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- e.g., status_change, comment, assignment
  details TEXT,
  performed_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create maintenance_asset_history table
CREATE TABLE IF NOT EXISTS maintenance_asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES maintenance_assets(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details TEXT,
  performed_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_assigned_to ON maintenance_tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_asset_id ON maintenance_tasks(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_assets_status ON maintenance_assets(status);
