-- =====================================================
-- STOREKEEPING MODULE - CORE TABLES
-- =====================================================

-- Create enums
CREATE TYPE item_category AS ENUM (
  'food',
  'beverage',
  'linen',
  'toiletries',
  'cleaning_supplies',
  'maintenance_items',
  'office_supplies',
  'kitchen_equipment',
  'amenities',
  'other'
);

CREATE TYPE unit_of_measurement AS ENUM (
  'pieces',
  'kg',
  'grams',
  'liters',
  'ml',
  'boxes',
  'cartons',
  'packets',
  'bottles',
  'cans',
  'rolls',
  'sets',
  'pairs',
  'units'
);

CREATE TYPE costing_method AS ENUM (
  'weighted_average',
  'fifo',
  'lifo',
  'standard'
);

-- Create departments table
CREATE TABLE store_departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES users(id),
  budget_allocated DECIMAL(12, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_budget CHECK (budget_allocated >= 0)
);

-- Create storage locations table
CREATE TABLE store_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT, -- warehouse, cold_storage, dry_storage, etc.
  capacity DECIMAL(10, 2),
  current_utilization DECIMAL(10, 2) DEFAULT 0,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_utilization CHECK (current_utilization >= 0 AND current_utilization <= capacity)
);

-- Create item master table
CREATE TABLE store_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category item_category NOT NULL,
  sub_category TEXT,
  unit unit_of_measurement NOT NULL,
  
  -- Stock levels
  current_stock DECIMAL(12, 3) DEFAULT 0 NOT NULL,
  minimum_stock DECIMAL(12, 3) DEFAULT 0 NOT NULL,
  maximum_stock DECIMAL(12, 3) DEFAULT 0 NOT NULL,
  reorder_level DECIMAL(12, 3) DEFAULT 0 NOT NULL,
  reorder_quantity DECIMAL(12, 3) DEFAULT 0,
  
  -- Costing
  unit_cost DECIMAL(12, 2) DEFAULT 0,
  average_cost DECIMAL(12, 2) DEFAULT 0,
  last_purchase_cost DECIMAL(12, 2) DEFAULT 0,
  costing_method costing_method DEFAULT 'weighted_average',
  
  -- Storage
  storage_location_id UUID REFERENCES store_locations(id),
  bin_location TEXT,
  
  -- Tracking
  barcode TEXT UNIQUE,
  qr_code TEXT,
  sku TEXT,
  hsn_code TEXT, -- for tax purposes
  
  -- Perishable items
  is_perishable BOOLEAN DEFAULT false,
  shelf_life_days INTEGER,
  
  -- Serial/Batch tracking
  track_serial_number BOOLEAN DEFAULT false,
  track_batch_number BOOLEAN DEFAULT false,
  track_expiry BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_discontinued BOOLEAN DEFAULT false,
  
  -- Metadata
  image_url TEXT,
  specifications JSONB,
  notes TEXT,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_stock_levels CHECK (
    current_stock >= 0 AND
    minimum_stock >= 0 AND
    maximum_stock >= minimum_stock AND
    reorder_level >= minimum_stock AND
    reorder_level <= maximum_stock
  ),
  CONSTRAINT valid_costs CHECK (
    unit_cost >= 0 AND
    average_cost >= 0 AND
    last_purchase_cost >= 0
  )
);

-- Create item suppliers mapping table
CREATE TABLE store_item_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES store_items(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID NOT NULL, -- Will reference suppliers table
  is_preferred BOOLEAN DEFAULT false,
  supplier_item_code TEXT,
  lead_time_days INTEGER DEFAULT 0,
  minimum_order_quantity DECIMAL(12, 3) DEFAULT 0,
  unit_price DECIMAL(12, 2) DEFAULT 0,
  last_supplied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_lead_time CHECK (lead_time_days >= 0),
  CONSTRAINT valid_moq CHECK (minimum_order_quantity >= 0),
  CONSTRAINT valid_price CHECK (unit_price >= 0),
  UNIQUE(item_id, supplier_id)
);

-- Create batch/lot tracking table
CREATE TABLE store_item_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES store_items(id) ON DELETE CASCADE NOT NULL,
  batch_number TEXT NOT NULL,
  serial_numbers TEXT[],
  quantity DECIMAL(12, 3) NOT NULL,
  remaining_quantity DECIMAL(12, 3) NOT NULL,
  manufacturing_date DATE,
  expiry_date DATE,
  received_date DATE NOT NULL,
  supplier_id UUID, -- Will reference suppliers table
  purchase_order_id UUID, -- Will reference purchase_orders table
  unit_cost DECIMAL(12, 2),
  storage_location_id UUID REFERENCES store_locations(id),
  is_expired BOOLEAN DEFAULT false,
  is_quarantined BOOLEAN DEFAULT false,
  quarantine_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_batch_quantity CHECK (
    quantity > 0 AND
    remaining_quantity >= 0 AND
    remaining_quantity <= quantity
  ),
  CONSTRAINT valid_dates CHECK (
    expiry_date IS NULL OR expiry_date >= manufacturing_date
  ),
  UNIQUE(item_id, batch_number)
);

-- Create indexes for performance
CREATE INDEX idx_store_items_category ON store_items(category);
CREATE INDEX idx_store_items_location ON store_items(storage_location_id);
CREATE INDEX idx_store_items_barcode ON store_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_store_items_active ON store_items(is_active);
CREATE INDEX idx_store_items_low_stock ON store_items(current_stock, reorder_level) WHERE current_stock <= reorder_level;
CREATE INDEX idx_store_item_batches_expiry ON store_item_batches(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_store_item_batches_item ON store_item_batches(item_id);
CREATE INDEX idx_store_departments_active ON store_departments(is_active);
CREATE INDEX idx_store_locations_active ON store_locations(is_active);

-- Create function to generate item code
CREATE OR REPLACE FUNCTION generate_item_code(p_category item_category)
RETURNS TEXT AS $$
DECLARE
  category_prefix TEXT;
  next_seq INT;
  item_code TEXT;
BEGIN
  -- Get category prefix
  category_prefix := CASE p_category
    WHEN 'food' THEN 'FD'
    WHEN 'beverage' THEN 'BV'
    WHEN 'linen' THEN 'LN'
    WHEN 'toiletries' THEN 'TL'
    WHEN 'cleaning_supplies' THEN 'CS'
    WHEN 'maintenance_items' THEN 'MT'
    WHEN 'office_supplies' THEN 'OF'
    WHEN 'kitchen_equipment' THEN 'KE'
    WHEN 'amenities' THEN 'AM'
    ELSE 'OT'
  END;
  
  -- Get next sequence
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_items
    WHERE item_code LIKE category_prefix || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  -- Generate item code
  item_code := category_prefix || LPAD(next_seq::TEXT, 6, '0');
  
  RETURN item_code;
END;
$$ LANGUAGE plpgsql;

-- Create function to check expiry and update status
CREATE OR REPLACE FUNCTION check_batch_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date <= CURRENT_DATE THEN
    NEW.is_expired := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_batch_expiry_trigger
  BEFORE INSERT OR UPDATE ON store_item_batches
  FOR EACH ROW
  EXECUTE FUNCTION check_batch_expiry();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_store_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_store_items_timestamp
  BEFORE UPDATE ON store_items
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_store_departments_timestamp
  BEFORE UPDATE ON store_departments
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_store_locations_timestamp
  BEFORE UPDATE ON store_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_store_item_batches_timestamp
  BEFORE UPDATE ON store_item_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

-- Insert default departments
INSERT INTO store_departments (code, name, description) VALUES
('F&B', 'Food & Beverage', 'Restaurant and kitchen operations'),
('HSK', 'Housekeeping', 'Room cleaning and linen management'),
('MNT', 'Maintenance', 'Property maintenance and repairs'),
('FRT', 'Front Office', 'Reception and guest services'),
('ADM', 'Administration', 'Office and administrative supplies');

-- Insert default storage locations
INSERT INTO store_locations (code, name, type, capacity) VALUES
('WH-01', 'Main Warehouse', 'warehouse', 1000.00),
('CS-01', 'Cold Storage', 'cold_storage', 200.00),
('DS-01', 'Dry Storage', 'dry_storage', 500.00),
('KS-01', 'Kitchen Store', 'kitchen_storage', 150.00),
('LS-01', 'Linen Store', 'linen_storage', 300.00);
