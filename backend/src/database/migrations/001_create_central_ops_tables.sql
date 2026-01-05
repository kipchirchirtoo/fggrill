
-- Create vendor_performance table
CREATE TABLE IF NOT EXISTS vendor_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL, -- Assuming linking to a vendors/suppliers table, but using UUID for flexibility or if it's a separate service
  vendor_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Metrics
  on_time_delivery_rate DECIMAL(5,2) DEFAULT 0, -- Percentage
  quality_rating DECIMAL(3,2) DEFAULT 0, -- 1-5 scale
  cost_variance DECIMAL(10,2) DEFAULT 0, -- Amount
  response_time_hours DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, under_review, suspended
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create procurement_orders table (Strategic Planning)
CREATE TABLE IF NOT EXISTS procurement_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Relationships
  branch_id INTEGER, -- Can be null for central orders
  supplier_id UUID,
  
  -- Order Details
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'KES',
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending_approval, approved, ordered, partial_delivery, delivered, cancelled
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, partial, paid
  
  -- Items (stored as JSONB for simplicity in this phase, or could be a separate table)
  items JSONB DEFAULT '[]',
  
  -- Metadata
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_vendor_perf_vendor_id ON vendor_performance(vendor_id);
CREATE INDEX IF NOT EXISTS idx_procurement_branch_id ON procurement_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_procurement_status ON procurement_orders(status);
