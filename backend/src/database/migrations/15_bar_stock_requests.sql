-- BAR STOCK REQUESTS - Kyogong
-- Created: 2025-12-01
-- Description: Allow bartenders to request stock items from central/branch store

-- Create status enum for stock requests
DO $$ BEGIN
    CREATE TYPE bar_stock_request_status AS ENUM ('pending', 'approved', 'partially_fulfilled', 'fulfilled', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bar Stock Requests Table
CREATE TABLE IF NOT EXISTS bar_stock_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number VARCHAR(50) UNIQUE NOT NULL,
  bar_branch_id INTEGER NOT NULL,
  store_branch_id INTEGER NOT NULL,
  requested_by UUID REFERENCES users(id),
  status bar_stock_request_status DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  fulfilled_by UUID REFERENCES users(id),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bar Stock Request Items Table
CREATE TABLE IF NOT EXISTS bar_stock_request_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES bar_stock_requests(id) ON DELETE CASCADE,
  drink_id UUID REFERENCES bar_drinks(id),
  item_name VARCHAR(255) NOT NULL, -- Store the name in case drink is deleted
  requested_quantity INTEGER NOT NULL,
  approved_quantity INTEGER DEFAULT 0,
  fulfilled_quantity INTEGER DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  current_stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bar_stock_requests_status ON bar_stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_bar_stock_requests_bar_branch ON bar_stock_requests(bar_branch_id);
CREATE INDEX IF NOT EXISTS idx_bar_stock_requests_store_branch ON bar_stock_requests(store_branch_id);
CREATE INDEX IF NOT EXISTS idx_bar_stock_requests_requested_by ON bar_stock_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_bar_stock_requests_date ON bar_stock_requests(requested_at);
CREATE INDEX IF NOT EXISTS idx_bar_stock_request_items_request ON bar_stock_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_bar_stock_request_items_drink ON bar_stock_request_items(drink_id);

-- Function to generate request number
CREATE OR REPLACE FUNCTION generate_bar_stock_request_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  new_number VARCHAR(50);
  counter INTEGER;
BEGIN
  -- Format: BSR-YYYYMMDD-XXXX (Bar Stock Request)
  SELECT COUNT(*) + 1 INTO counter
  FROM bar_stock_requests
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_number := 'BSR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate request number
CREATE OR REPLACE FUNCTION set_bar_stock_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_bar_stock_request_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_bar_stock_request_number
  BEFORE INSERT ON bar_stock_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_bar_stock_request_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bar_stock_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bar_stock_request_timestamp
  BEFORE UPDATE ON bar_stock_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_bar_stock_request_timestamp();

CREATE TRIGGER trigger_update_bar_stock_request_items_timestamp
  BEFORE UPDATE ON bar_stock_request_items
  FOR EACH ROW
  EXECUTE FUNCTION update_bar_stock_request_timestamp();

-- Function to auto-update request status based on items
CREATE OR REPLACE FUNCTION update_bar_stock_request_status()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  fulfilled_items INTEGER;
  partially_fulfilled_items INTEGER;
BEGIN
  -- Count total items and fulfilled items for this request
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN fulfilled_quantity >= requested_quantity THEN 1 END),
    COUNT(CASE WHEN fulfilled_quantity > 0 AND fulfilled_quantity < requested_quantity THEN 1 END)
  INTO total_items, fulfilled_items, partially_fulfilled_items
  FROM bar_stock_request_items
  WHERE request_id = NEW.request_id;

  -- Update request status
  IF fulfilled_items = total_items AND total_items > 0 THEN
    UPDATE bar_stock_requests 
    SET status = 'fulfilled',
        fulfilled_at = NOW()
    WHERE id = NEW.request_id AND status != 'fulfilled';
  ELSIF partially_fulfilled_items > 0 OR fulfilled_items > 0 THEN
    UPDATE bar_stock_requests 
    SET status = 'partially_fulfilled'
    WHERE id = NEW.request_id AND status NOT IN ('fulfilled', 'cancelled', 'rejected');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_request_status_after_item_update
  AFTER UPDATE OF fulfilled_quantity ON bar_stock_request_items
  FOR EACH ROW
  EXECUTE FUNCTION update_bar_stock_request_status();

-- Enable RLS
ALTER TABLE bar_stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_stock_request_items ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "bar_stock_requests_read" ON bar_stock_requests;
CREATE POLICY "bar_stock_requests_read" ON bar_stock_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "bar_stock_requests_insert" ON bar_stock_requests;
CREATE POLICY "bar_stock_requests_insert" ON bar_stock_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "bar_stock_requests_update" ON bar_stock_requests;
CREATE POLICY "bar_stock_requests_update" ON bar_stock_requests FOR UPDATE USING (true);

DROP POLICY IF EXISTS "bar_stock_request_items_all" ON bar_stock_request_items;
CREATE POLICY "bar_stock_request_items_all" ON bar_stock_request_items FOR ALL USING (true);

SELECT 'Bar stock requests tables created successfully' AS status;
