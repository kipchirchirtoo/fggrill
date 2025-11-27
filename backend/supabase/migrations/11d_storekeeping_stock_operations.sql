-- =====================================================
-- STOREKEEPING MODULE - STOCK OPERATIONS
-- =====================================================

CREATE TYPE movement_type AS ENUM (
  'receipt',           -- Goods received
  'issue',            -- Issued to department
  'return',           -- Returned to store
  'transfer_out',     -- Transfer to another location
  'transfer_in',      -- Transfer from another location
  'adjustment_plus',  -- Stock increase adjustment
  'adjustment_minus', -- Stock decrease adjustment
  'damage',           -- Damaged stock
  'expiry',           -- Expired stock
  'theft',            -- Stock theft/loss
  'opening_balance'   -- Opening stock
);

CREATE TYPE issue_status AS ENUM (
  'pending',
  'approved',
  'issued',
  'partially_issued',
  'rejected',
  'cancelled'
);

CREATE TYPE adjustment_reason AS ENUM (
  'physical_count',
  'damage',
  'theft',
  'spoilage',
  'expiry',
  'breakage',
  'system_error',
  'other'
);

CREATE TYPE transfer_status AS ENUM (
  'pending',
  'in_transit',
  'received',
  'rejected',
  'cancelled'
);

-- Create stock movements table (main ledger)
CREATE TABLE store_stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_number TEXT NOT NULL UNIQUE,
  
  item_id UUID REFERENCES store_items(id) NOT NULL,
  batch_id UUID REFERENCES store_item_batches(id),
  
  movement_type movement_type NOT NULL,
  movement_date DATE NOT NULL,
  
  quantity DECIMAL(12, 3) NOT NULL,
  unit_cost DECIMAL(12, 2),
  total_value DECIMAL(12, 2),
  
  -- Stock levels
  stock_before DECIMAL(12, 3) NOT NULL,
  stock_after DECIMAL(12, 3) NOT NULL,
  
  -- Location tracking
  from_location_id UUID REFERENCES store_locations(id),
  to_location_id UUID REFERENCES store_locations(id),
  
  -- Department tracking
  from_department_id UUID REFERENCES store_departments(id),
  to_department_id UUID REFERENCES store_departments(id),
  
  -- Reference documents
  reference_type TEXT, -- grn, issue, transfer, adjustment, etc.
  reference_id UUID,
  reference_number TEXT,
  
  notes TEXT,
  performed_by_id UUID REFERENCES users(id) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_movement_quantity CHECK (quantity > 0),
  CONSTRAINT valid_stock_levels CHECK (
    stock_before >= 0 AND
    stock_after >= 0
  )
);

-- Create stock issues table
CREATE TABLE store_stock_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_number TEXT NOT NULL UNIQUE,
  
  department_id UUID REFERENCES store_departments(id) NOT NULL,
  requested_by_id UUID REFERENCES users(id) NOT NULL,
  
  issue_date DATE NOT NULL,
  required_date DATE,
  
  issue_type TEXT, -- direct_consumption, transfer, recipe_based
  status issue_status DEFAULT 'pending',
  
  purpose TEXT,
  
  -- Approval
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  -- Issuance
  issued_by_id UUID REFERENCES users(id),
  issued_at TIMESTAMP WITH TIME ZONE,
  
  total_items INTEGER DEFAULT 0,
  total_value DECIMAL(12, 2) DEFAULT 0,
  
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_issue_dates CHECK (required_date IS NULL OR required_date >= issue_date)
);

-- Create stock issue items table
CREATE TABLE store_issue_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID REFERENCES store_stock_issues(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES store_items(id) NOT NULL,
  batch_id UUID REFERENCES store_item_batches(id),
  
  quantity_requested DECIMAL(12, 3) NOT NULL,
  quantity_approved DECIMAL(12, 3),
  quantity_issued DECIMAL(12, 3) DEFAULT 0,
  
  unit_cost DECIMAL(12, 2),
  total_value DECIMAL(12, 2),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_issue_quantities CHECK (
    quantity_requested > 0 AND
    (quantity_approved IS NULL OR quantity_approved >= 0) AND
    quantity_issued >= 0 AND
    quantity_issued <= COALESCE(quantity_approved, quantity_requested)
  )
);

-- Create stock returns table
CREATE TABLE store_stock_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_number TEXT NOT NULL UNIQUE,
  
  issue_id UUID REFERENCES store_stock_issues(id),
  department_id UUID REFERENCES store_departments(id) NOT NULL,
  
  return_date DATE NOT NULL,
  reason TEXT NOT NULL,
  
  returned_by_id UUID REFERENCES users(id) NOT NULL,
  received_by_id UUID REFERENCES users(id),
  
  total_items INTEGER DEFAULT 0,
  total_value DECIMAL(12, 2) DEFAULT 0,
  
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create stock return items table
CREATE TABLE store_return_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID REFERENCES store_stock_returns(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES store_items(id) NOT NULL,
  batch_id UUID REFERENCES store_item_batches(id),
  
  quantity_returned DECIMAL(12, 3) NOT NULL,
  unit_cost DECIMAL(12, 2),
  total_value DECIMAL(12, 2),
  
  condition TEXT, -- good, damaged, expired
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_return_quantity CHECK (quantity_returned > 0)
);

-- Create stock transfers table
CREATE TABLE store_stock_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number TEXT NOT NULL UNIQUE,
  
  from_location_id UUID REFERENCES store_locations(id) NOT NULL,
  to_location_id UUID REFERENCES store_locations(id) NOT NULL,
  
  transfer_date DATE NOT NULL,
  expected_receipt_date DATE,
  actual_receipt_date DATE,
  
  status transfer_status DEFAULT 'pending',
  
  initiated_by_id UUID REFERENCES users(id) NOT NULL,
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  dispatched_by_id UUID REFERENCES users(id),
  dispatched_at TIMESTAMP WITH TIME ZONE,
  
  received_by_id UUID REFERENCES users(id),
  received_at TIMESTAMP WITH TIME ZONE,
  
  total_items INTEGER DEFAULT 0,
  total_value DECIMAL(12, 2) DEFAULT 0,
  
  vehicle_number TEXT,
  driver_name TEXT,
  remarks TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT different_locations CHECK (from_location_id != to_location_id)
);

-- Create stock transfer items table
CREATE TABLE store_transfer_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID REFERENCES store_stock_transfers(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES store_items(id) NOT NULL,
  batch_id UUID REFERENCES store_item_batches(id),
  
  quantity_sent DECIMAL(12, 3) NOT NULL,
  quantity_received DECIMAL(12, 3) DEFAULT 0,
  quantity_damaged DECIMAL(12, 3) DEFAULT 0,
  
  unit_cost DECIMAL(12, 2),
  total_value DECIMAL(12, 2),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_transfer_quantities CHECK (
    quantity_sent > 0 AND
    quantity_received >= 0 AND
    quantity_damaged >= 0 AND
    quantity_received + quantity_damaged <= quantity_sent
  )
);

-- Create stock adjustments table
CREATE TABLE store_stock_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_number TEXT NOT NULL UNIQUE,
  
  adjustment_date DATE NOT NULL,
  reason adjustment_reason NOT NULL,
  reason_description TEXT,
  
  -- Approval workflow
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  requested_by_id UUID REFERENCES users(id) NOT NULL,
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  total_items INTEGER DEFAULT 0,
  total_value_impact DECIMAL(12, 2) DEFAULT 0,
  
  supporting_documents JSONB,
  remarks TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create stock adjustment items table
CREATE TABLE store_adjustment_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_id UUID REFERENCES store_stock_adjustments(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES store_items(id) NOT NULL,
  batch_id UUID REFERENCES store_item_batches(id),
  
  system_quantity DECIMAL(12, 3) NOT NULL,
  actual_quantity DECIMAL(12, 3) NOT NULL,
  variance_quantity DECIMAL(12, 3) NOT NULL,
  
  unit_cost DECIMAL(12, 2),
  variance_value DECIMAL(12, 2),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_adjustment_quantities CHECK (
    system_quantity >= 0 AND
    actual_quantity >= 0
  )
);

-- Create physical stock count table
CREATE TABLE store_physical_counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  count_number TEXT NOT NULL UNIQUE,
  
  count_date DATE NOT NULL,
  count_type TEXT NOT NULL, -- full, cycle, spot
  
  location_id UUID REFERENCES store_locations(id),
  category item_category,
  
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, approved
  
  started_by_id UUID REFERENCES users(id) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  completed_by_id UUID REFERENCES users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  total_items_counted INTEGER DEFAULT 0,
  total_variance_value DECIMAL(12, 2) DEFAULT 0,
  
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create physical count items table
CREATE TABLE store_count_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  count_id UUID REFERENCES store_physical_counts(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES store_items(id) NOT NULL,
  batch_id UUID REFERENCES store_item_batches(id),
  
  system_quantity DECIMAL(12, 3) NOT NULL,
  counted_quantity DECIMAL(12, 3),
  variance_quantity DECIMAL(12, 3),
  
  unit_cost DECIMAL(12, 2),
  variance_value DECIMAL(12, 2),
  
  counted_by_id UUID REFERENCES users(id),
  counted_at TIMESTAMP WITH TIME ZONE,
  
  verified_by_id UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_stock_movements_item ON store_stock_movements(item_id);
CREATE INDEX idx_stock_movements_date ON store_stock_movements(movement_date);
CREATE INDEX idx_stock_movements_type ON store_stock_movements(movement_type);
CREATE INDEX idx_stock_movements_reference ON store_stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_issues_department ON store_stock_issues(department_id);
CREATE INDEX idx_stock_issues_status ON store_stock_issues(status);
CREATE INDEX idx_stock_issues_date ON store_stock_issues(issue_date);
CREATE INDEX idx_stock_transfers_status ON store_stock_transfers(status);
CREATE INDEX idx_stock_transfers_locations ON store_stock_transfers(from_location_id, to_location_id);
CREATE INDEX idx_stock_adjustments_date ON store_stock_adjustments(adjustment_date);
CREATE INDEX idx_physical_counts_status ON store_physical_counts(status);

-- Create function to generate movement number
CREATE OR REPLACE FUNCTION generate_movement_number()
RETURNS TEXT AS $$
DECLARE
  mov_date TEXT;
  next_seq INT;
  mov_number TEXT;
BEGIN
  mov_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_stock_movements
    WHERE movement_number LIKE 'MOV' || mov_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  mov_number := 'MOV' || mov_date || LPAD(next_seq::TEXT, 5, '0');
  
  RETURN mov_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate issue number
CREATE OR REPLACE FUNCTION generate_issue_number()
RETURNS TEXT AS $$
DECLARE
  issue_date TEXT;
  next_seq INT;
  issue_number TEXT;
BEGIN
  issue_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_stock_issues
    WHERE issue_number LIKE 'ISS' || issue_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  issue_number := 'ISS' || issue_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN issue_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate transfer number
CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS TEXT AS $$
DECLARE
  transfer_date TEXT;
  next_seq INT;
  transfer_number TEXT;
BEGIN
  transfer_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_stock_transfers
    WHERE transfer_number LIKE 'TRF' || transfer_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  transfer_number := 'TRF' || transfer_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN transfer_number;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_stock_issues_timestamp
  BEFORE UPDATE ON store_stock_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_stock_returns_timestamp
  BEFORE UPDATE ON store_stock_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_stock_transfers_timestamp
  BEFORE UPDATE ON store_stock_transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_stock_adjustments_timestamp
  BEFORE UPDATE ON store_stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_physical_counts_timestamp
  BEFORE UPDATE ON store_physical_counts
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_count_items_timestamp
  BEFORE UPDATE ON store_count_items
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();
