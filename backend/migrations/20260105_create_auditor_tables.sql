-- Create stock_requests table
CREATE TABLE IF NOT EXISTS stock_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id BIGINT REFERENCES branches(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'partial', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT
);

-- Create stock_request_items table
CREATE TABLE IF NOT EXISTS stock_request_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES stock_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id),
  quantity_requested NUMERIC NOT NULL,
  quantity_approved NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create staff_credit_limits table
CREATE TABLE IF NOT EXISTS staff_credit_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE UNIQUE,
  monthly_limit NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create staff_credit_bills table
CREATE TABLE IF NOT EXISTS staff_credit_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'deducted', 'rejected')),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_requests_branch ON stock_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_request_items_request ON stock_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_staff ON staff_credit_bills(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_status ON staff_credit_bills(status);
