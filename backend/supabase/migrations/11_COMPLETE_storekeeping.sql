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
-- =====================================================
-- STOREKEEPING MODULE - SUPPLIERS & VENDORS
-- =====================================================

CREATE TYPE supplier_status AS ENUM (
  'active',
  'inactive',
  'blacklisted',
  'pending_approval'
);

CREATE TYPE payment_terms AS ENUM (
  'cash',
  'credit_7_days',
  'credit_15_days',
  'credit_30_days',
  'credit_45_days',
  'credit_60_days',
  'credit_90_days',
  'advance_payment'
);

-- Create suppliers/vendors table
CREATE TABLE store_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  legal_name TEXT,
  
  -- Contact information
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  alternate_phone TEXT,
  website TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Kenya',
  postal_code TEXT,
  
  -- Business details
  tax_id TEXT,
  vat_number TEXT,
  registration_number TEXT,
  
  -- Payment terms
  payment_terms payment_terms DEFAULT 'credit_30_days',
  credit_limit DECIMAL(12, 2) DEFAULT 0,
  current_outstanding DECIMAL(12, 2) DEFAULT 0,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_branch TEXT,
  
  -- Performance metrics
  lead_time_days INTEGER DEFAULT 7,
  on_time_delivery_rate DECIMAL(5, 2) DEFAULT 100.00, -- percentage
  quality_rating DECIMAL(3, 2) DEFAULT 5.00, -- out of 5
  total_orders INTEGER DEFAULT 0,
  total_purchase_value DECIMAL(15, 2) DEFAULT 0,
  
  -- Status
  status supplier_status DEFAULT 'active',
  is_preferred BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  
  -- Metadata
  notes TEXT,
  documents JSONB, -- Store document URLs
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  last_order_date TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_credit_limit CHECK (credit_limit >= 0),
  CONSTRAINT valid_outstanding CHECK (current_outstanding >= 0),
  CONSTRAINT valid_rating CHECK (quality_rating >= 0 AND quality_rating <= 5),
  CONSTRAINT valid_delivery_rate CHECK (on_time_delivery_rate >= 0 AND on_time_delivery_rate <= 100)
);

-- Create supplier quotations table
CREATE TABLE store_supplier_quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES store_suppliers(id) ON DELETE CASCADE NOT NULL,
  
  quotation_date DATE NOT NULL,
  valid_until DATE,
  
  items JSONB NOT NULL, -- Array of {item_id, item_name, quantity, unit_price, total_price}
  
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  
  payment_terms payment_terms,
  delivery_terms TEXT,
  notes TEXT,
  
  is_selected BOOLEAN DEFAULT false,
  selected_at TIMESTAMP WITH TIME ZONE,
  selected_by_id UUID REFERENCES users(id),
  
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_quotation_amounts CHECK (
    subtotal >= 0 AND
    tax_amount >= 0 AND
    discount_amount >= 0 AND
    total_amount >= 0 AND
    total_amount = subtotal + tax_amount - discount_amount
  ),
  CONSTRAINT valid_dates CHECK (valid_until IS NULL OR valid_until >= quotation_date)
);

-- Create supplier performance tracking table
CREATE TABLE store_supplier_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES store_suppliers(id) ON DELETE CASCADE NOT NULL,
  evaluation_date DATE NOT NULL,
  
  -- Rating criteria (1-5 scale)
  quality_rating DECIMAL(3, 2) NOT NULL,
  delivery_rating DECIMAL(3, 2) NOT NULL,
  price_rating DECIMAL(3, 2) NOT NULL,
  service_rating DECIMAL(3, 2) NOT NULL,
  communication_rating DECIMAL(3, 2) NOT NULL,
  
  overall_rating DECIMAL(3, 2) NOT NULL,
  
  comments TEXT,
  evaluated_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_ratings CHECK (
    quality_rating >= 0 AND quality_rating <= 5 AND
    delivery_rating >= 0 AND delivery_rating <= 5 AND
    price_rating >= 0 AND price_rating <= 5 AND
    service_rating >= 0 AND service_rating <= 5 AND
    communication_rating >= 0 AND communication_rating <= 5 AND
    overall_rating >= 0 AND overall_rating <= 5
  )
);

-- Add foreign key to item_suppliers table
ALTER TABLE store_item_suppliers
  ADD CONSTRAINT fk_item_suppliers_supplier
  FOREIGN KEY (supplier_id) REFERENCES store_suppliers(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_store_suppliers_status ON store_suppliers(status);
CREATE INDEX idx_store_suppliers_code ON store_suppliers(supplier_code);
CREATE INDEX idx_store_suppliers_preferred ON store_suppliers(is_preferred) WHERE is_preferred = true;
CREATE INDEX idx_store_quotations_supplier ON store_supplier_quotations(supplier_id);
CREATE INDEX idx_store_quotations_date ON store_supplier_quotations(quotation_date);
CREATE INDEX idx_store_performance_supplier ON store_supplier_performance(supplier_id);

-- Create function to generate supplier code
CREATE OR REPLACE FUNCTION generate_supplier_code()
RETURNS TEXT AS $$
DECLARE
  next_seq INT;
  supplier_code TEXT;
BEGIN
  -- Get next sequence
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_suppliers
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  -- Generate supplier code
  supplier_code := 'SUP' || LPAD(next_seq::TEXT, 5, '0');
  
  RETURN supplier_code;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate quotation number
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  quote_date TEXT;
  next_seq INT;
  quotation_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  quote_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_supplier_quotations
    WHERE quotation_number LIKE 'QT' || quote_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  -- Generate quotation number
  quotation_number := 'QT' || quote_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN quotation_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update supplier performance metrics
CREATE OR REPLACE FUNCTION update_supplier_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update supplier's average rating
  UPDATE store_suppliers
  SET 
    quality_rating = (
      SELECT AVG(overall_rating)
      FROM store_supplier_performance
      WHERE supplier_id = NEW.supplier_id
    ),
    updated_at = NOW()
  WHERE id = NEW.supplier_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_supplier_metrics_trigger
  AFTER INSERT ON store_supplier_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_metrics();

-- Create trigger for timestamp updates
CREATE TRIGGER update_store_suppliers_timestamp
  BEFORE UPDATE ON store_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_store_quotations_timestamp
  BEFORE UPDATE ON store_supplier_quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();
-- =====================================================
-- STOREKEEPING MODULE - PURCHASE MANAGEMENT
-- =====================================================

CREATE TYPE requisition_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'converted_to_po',
  'cancelled'
);

CREATE TYPE requisition_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

CREATE TYPE po_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'sent_to_supplier',
  'partially_received',
  'fully_received',
  'cancelled',
  'closed'
);

CREATE TYPE grn_status AS ENUM (
  'draft',
  'completed',
  'partially_accepted',
  'rejected'
);

-- Create purchase requisitions table
CREATE TABLE store_purchase_requisitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_number TEXT NOT NULL UNIQUE,
  
  department_id UUID REFERENCES store_departments(id) NOT NULL,
  requested_by_id UUID REFERENCES users(id) NOT NULL,
  
  requisition_date DATE NOT NULL,
  required_by_date DATE,
  
  priority requisition_priority DEFAULT 'normal',
  status requisition_status DEFAULT 'draft',
  
  purpose TEXT,
  justification TEXT,
  
  -- Approval workflow
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  rejected_by_id UUID REFERENCES users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Conversion to PO
  converted_to_po BOOLEAN DEFAULT false,
  purchase_order_id UUID, -- Will reference store_purchase_orders
  converted_at TIMESTAMP WITH TIME ZONE,
  converted_by_id UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_dates CHECK (required_by_date IS NULL OR required_by_date >= requisition_date)
);

-- Create requisition items table
CREATE TABLE store_requisition_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id UUID REFERENCES store_purchase_requisitions(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES store_items(id) NOT NULL,
  
  quantity_requested DECIMAL(12, 3) NOT NULL,
  quantity_approved DECIMAL(12, 3),
  
  estimated_unit_cost DECIMAL(12, 2),
  estimated_total_cost DECIMAL(12, 2),
  
  specification TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_quantities CHECK (
    quantity_requested > 0 AND
    (quantity_approved IS NULL OR quantity_approved >= 0)
  )
);

-- Create purchase orders table
CREATE TABLE store_purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL,
  requisition_id UUID REFERENCES store_purchase_requisitions(id),
  quotation_id UUID REFERENCES store_supplier_quotations(id),
  
  po_date DATE NOT NULL,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  
  status po_status DEFAULT 'draft',
  priority requisition_priority DEFAULT 'normal',
  
  -- Financial details
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 16.00, -- VAT percentage
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  shipping_cost DECIMAL(12, 2) DEFAULT 0,
  other_charges DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  
  -- Terms and conditions
  payment_terms payment_terms DEFAULT 'credit_30_days',
  delivery_terms TEXT,
  warranty_terms TEXT,
  special_instructions TEXT,
  
  -- Approval workflow
  created_by_id UUID REFERENCES users(id) NOT NULL,
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Sending to supplier
  sent_to_supplier BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by_id UUID REFERENCES users(id),
  supplier_email TEXT,
  
  -- Receiving
  received_by_id UUID REFERENCES users(id),
  received_at TIMESTAMP WITH TIME ZONE,
  
  -- Closure
  closed_by_id UUID REFERENCES users(id),
  closed_at TIMESTAMP WITH TIME ZONE,
  closure_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_po_amounts CHECK (
    subtotal >= 0 AND
    tax_amount >= 0 AND
    discount_amount >= 0 AND
    shipping_cost >= 0 AND
    other_charges >= 0 AND
    total_amount >= 0
  ),
  CONSTRAINT valid_po_dates CHECK (
    expected_delivery_date IS NULL OR expected_delivery_date >= po_date
  )
);

-- Create purchase order items table
CREATE TABLE store_po_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID REFERENCES store_purchase_orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES store_items(id) NOT NULL,
  
  quantity_ordered DECIMAL(12, 3) NOT NULL,
  quantity_received DECIMAL(12, 3) DEFAULT 0,
  quantity_pending DECIMAL(12, 3) NOT NULL,
  quantity_rejected DECIMAL(12, 3) DEFAULT 0,
  
  unit_price DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  total_price DECIMAL(12, 2) NOT NULL,
  
  specification TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_po_item_quantities CHECK (
    quantity_ordered > 0 AND
    quantity_received >= 0 AND
    quantity_pending >= 0 AND
    quantity_rejected >= 0 AND
    quantity_received + quantity_pending + quantity_rejected <= quantity_ordered
  ),
  CONSTRAINT valid_po_item_prices CHECK (
    unit_price >= 0 AND
    total_price >= 0
  )
);

-- Add foreign key for requisition conversion
ALTER TABLE store_purchase_requisitions
  ADD CONSTRAINT fk_requisition_po
  FOREIGN KEY (purchase_order_id) REFERENCES store_purchase_orders(id);

-- Create Goods Receipt Note (GRN) table
CREATE TABLE store_grn (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_number TEXT NOT NULL UNIQUE,
  
  po_id UUID REFERENCES store_purchase_orders(id),
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL,
  
  grn_date DATE NOT NULL,
  invoice_number TEXT,
  invoice_date DATE,
  delivery_note_number TEXT,
  
  status grn_status DEFAULT 'draft',
  
  -- Quality check
  quality_checked BOOLEAN DEFAULT false,
  quality_checked_by_id UUID REFERENCES users(id),
  quality_check_date DATE,
  quality_notes TEXT,
  
  -- Receiving details
  received_by_id UUID REFERENCES users(id) NOT NULL,
  vehicle_number TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  
  total_items INTEGER DEFAULT 0,
  total_quantity DECIMAL(12, 3) DEFAULT 0,
  total_value DECIMAL(12, 2) DEFAULT 0,
  
  remarks TEXT,
  attachments JSONB, -- Store document URLs
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_grn_totals CHECK (
    total_items >= 0 AND
    total_quantity >= 0 AND
    total_value >= 0
  )
);

-- Create GRN items table
CREATE TABLE store_grn_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID REFERENCES store_grn(id) ON DELETE CASCADE NOT NULL,
  po_item_id UUID REFERENCES store_po_items(id),
  item_id UUID REFERENCES store_items(id) NOT NULL,
  
  quantity_ordered DECIMAL(12, 3),
  quantity_received DECIMAL(12, 3) NOT NULL,
  quantity_accepted DECIMAL(12, 3) NOT NULL,
  quantity_rejected DECIMAL(12, 3) DEFAULT 0,
  quantity_damaged DECIMAL(12, 3) DEFAULT 0,
  
  unit_price DECIMAL(12, 2) NOT NULL,
  total_value DECIMAL(12, 2) NOT NULL,
  
  -- Batch/Lot tracking
  batch_number TEXT,
  manufacturing_date DATE,
  expiry_date DATE,
  
  -- Quality inspection
  quality_status TEXT, -- accepted, rejected, conditional
  rejection_reason TEXT,
  damage_reason TEXT,
  
  storage_location_id UUID REFERENCES store_locations(id),
  bin_location TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_grn_item_quantities CHECK (
    quantity_received > 0 AND
    quantity_accepted >= 0 AND
    quantity_rejected >= 0 AND
    quantity_damaged >= 0 AND
    quantity_accepted + quantity_rejected + quantity_damaged = quantity_received
  ),
  CONSTRAINT valid_grn_item_prices CHECK (
    unit_price >= 0 AND
    total_value >= 0
  )
);

-- Create indexes
CREATE INDEX idx_requisitions_department ON store_purchase_requisitions(department_id);
CREATE INDEX idx_requisitions_status ON store_purchase_requisitions(status);
CREATE INDEX idx_requisitions_date ON store_purchase_requisitions(requisition_date);
CREATE INDEX idx_requisitions_priority ON store_purchase_requisitions(priority);
CREATE INDEX idx_po_supplier ON store_purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON store_purchase_orders(status);
CREATE INDEX idx_po_date ON store_purchase_orders(po_date);
CREATE INDEX idx_grn_po ON store_grn(po_id);
CREATE INDEX idx_grn_supplier ON store_grn(supplier_id);
CREATE INDEX idx_grn_date ON store_grn(grn_date);

-- Create function to generate requisition number
CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS TEXT AS $$
DECLARE
  req_date TEXT;
  next_seq INT;
  req_number TEXT;
BEGIN
  req_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_purchase_requisitions
    WHERE requisition_number LIKE 'REQ' || req_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  req_number := 'REQ' || req_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN req_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
  po_date TEXT;
  next_seq INT;
  po_number TEXT;
BEGIN
  po_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_purchase_orders
    WHERE po_number LIKE 'PO' || po_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  po_number := 'PO' || po_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN po_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate GRN number
CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS TEXT AS $$
DECLARE
  grn_date TEXT;
  next_seq INT;
  grn_number TEXT;
BEGIN
  grn_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_grn
    WHERE grn_number LIKE 'GRN' || grn_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  grn_number := 'GRN' || grn_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN grn_number;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_requisitions_timestamp
  BEFORE UPDATE ON store_purchase_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_po_timestamp
  BEFORE UPDATE ON store_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_po_items_timestamp
  BEFORE UPDATE ON store_po_items
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

CREATE TRIGGER update_grn_timestamp
  BEFORE UPDATE ON store_grn
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();
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
-- =====================================================
-- STOREKEEPING MODULE - ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE store_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_item_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_item_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_supplier_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_grn ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_issue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_physical_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_count_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DEPARTMENTS POLICIES
-- =====================================================

CREATE POLICY "Staff can view departments"
  ON store_departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Admins can manage departments"
  ON store_departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- =====================================================
-- LOCATIONS POLICIES
-- =====================================================

CREATE POLICY "Staff can view locations"
  ON store_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Admins can manage locations"
  ON store_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- ITEMS POLICIES
-- =====================================================

CREATE POLICY "Staff can view items"
  ON store_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage items"
  ON store_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- SUPPLIERS POLICIES
-- =====================================================

CREATE POLICY "Staff can view suppliers"
  ON store_suppliers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Authorized staff can manage suppliers"
  ON store_suppliers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- PURCHASE REQUISITIONS POLICIES
-- =====================================================

CREATE POLICY "Department staff can view their requisitions"
  ON store_purchase_requisitions FOR SELECT
  USING (
    auth.uid() = requested_by_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Staff can create requisitions"
  ON store_purchase_requisitions FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Managers can update requisitions"
  ON store_purchase_requisitions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- PURCHASE ORDERS POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view purchase orders"
  ON store_purchase_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage purchase orders"
  ON store_purchase_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- GRN POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view GRN"
  ON store_grn FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage GRN"
  ON store_grn FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- STOCK MOVEMENTS POLICIES
-- =====================================================

CREATE POLICY "Staff can view stock movements"
  ON store_stock_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper', 'housekeeping', 'maintenance', 'restaurant')
    )
  );

CREATE POLICY "Storekeepers can create stock movements"
  ON store_stock_movements FOR INSERT
  WITH CHECK (
    auth.uid() = performed_by_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- STOCK ISSUES POLICIES
-- =====================================================

CREATE POLICY "Department staff can view their issues"
  ON store_stock_issues FOR SELECT
  USING (
    auth.uid() = requested_by_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Staff can create stock issues"
  ON store_stock_issues FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage stock issues"
  ON store_stock_issues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- STOCK TRANSFERS POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view transfers"
  ON store_stock_transfers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage transfers"
  ON store_stock_transfers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- STOCK ADJUSTMENTS POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view adjustments"
  ON store_stock_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can create adjustments"
  ON store_stock_adjustments FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Managers can approve adjustments"
  ON store_stock_adjustments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- =====================================================
-- PHYSICAL COUNTS POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view counts"
  ON store_physical_counts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage counts"
  ON store_physical_counts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- CHILD TABLES POLICIES (inherit from parent)
-- =====================================================

-- Item suppliers
CREATE POLICY "Inherit from items" ON store_item_suppliers FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Item batches
CREATE POLICY "Inherit from items" ON store_item_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Supplier quotations
CREATE POLICY "Inherit from suppliers" ON store_supplier_quotations FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Supplier performance
CREATE POLICY "Inherit from suppliers" ON store_supplier_performance FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Requisition items
CREATE POLICY "Inherit from requisitions" ON store_requisition_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper', 'housekeeping', 'maintenance', 'restaurant')));

-- PO items
CREATE POLICY "Inherit from PO" ON store_po_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- GRN items
CREATE POLICY "Inherit from GRN" ON store_grn_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Issue items
CREATE POLICY "Inherit from issues" ON store_issue_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper', 'housekeeping', 'maintenance', 'restaurant')));

-- Return items
CREATE POLICY "Inherit from returns" ON store_return_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper', 'housekeeping', 'maintenance', 'restaurant')));

-- Transfer items
CREATE POLICY "Inherit from transfers" ON store_transfer_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Adjustment items
CREATE POLICY "Inherit from adjustments" ON store_adjustment_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Count items
CREATE POLICY "Inherit from counts" ON store_count_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));
-- =====================================================
-- STOREKEEPING MODULE - ADVANCED FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update item stock on GRN
CREATE OR REPLACE FUNCTION process_grn_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_batch_id UUID;
BEGIN
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- Create or update batch if batch tracking is enabled
  IF v_item_record.track_batch_number THEN
    INSERT INTO store_item_batches (
      item_id,
      batch_number,
      quantity,
      remaining_quantity,
      manufacturing_date,
      expiry_date,
      received_date,
      supplier_id,
      unit_cost,
      storage_location_id
    ) VALUES (
      NEW.item_id,
      NEW.batch_number,
      NEW.quantity_accepted,
      NEW.quantity_accepted,
      NEW.manufacturing_date,
      NEW.expiry_date,
      CURRENT_DATE,
      (SELECT supplier_id FROM store_grn WHERE id = NEW.grn_id),
      NEW.unit_price,
      NEW.storage_location_id
    )
    ON CONFLICT (item_id, batch_number) 
    DO UPDATE SET
      quantity = store_item_batches.quantity + NEW.quantity_accepted,
      remaining_quantity = store_item_batches.remaining_quantity + NEW.quantity_accepted
    RETURNING id INTO v_batch_id;
  END IF;
  
  -- Update item stock
  UPDATE store_items
  SET 
    current_stock = current_stock + NEW.quantity_accepted,
    last_purchase_cost = NEW.unit_price,
    average_cost = CASE
      WHEN current_stock + NEW.quantity_accepted > 0 THEN
        ((current_stock * average_cost) + (NEW.quantity_accepted * NEW.unit_price)) / 
        (current_stock + NEW.quantity_accepted)
      ELSE NEW.unit_price
    END,
    updated_at = NOW()
  WHERE id = NEW.item_id;
  
  -- Create stock movement record
  INSERT INTO store_stock_movements (
    movement_number,
    item_id,
    batch_id,
    movement_type,
    movement_date,
    quantity,
    unit_cost,
    total_value,
    stock_before,
    stock_after,
    to_location_id,
    reference_type,
    reference_id,
    reference_number,
    notes,
    performed_by_id
  ) VALUES (
    generate_movement_number(),
    NEW.item_id,
    v_batch_id,
    'receipt',
    CURRENT_DATE,
    NEW.quantity_accepted,
    NEW.unit_price,
    NEW.total_value,
    v_item_record.current_stock,
    v_item_record.current_stock + NEW.quantity_accepted,
    NEW.storage_location_id,
    'grn',
    NEW.grn_id,
    (SELECT grn_number FROM store_grn WHERE id = NEW.grn_id),
    'Goods received via GRN',
    (SELECT received_by_id FROM store_grn WHERE id = NEW.grn_id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_grn_receipt_trigger
  AFTER INSERT ON store_grn_items
  FOR EACH ROW
  EXECUTE FUNCTION process_grn_receipt();

-- Function to process stock issue
CREATE OR REPLACE FUNCTION process_stock_issue()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_batch_id UUID;
  v_issue_record RECORD;
BEGIN
  -- Get issue details
  SELECT * INTO v_issue_record FROM store_stock_issues WHERE id = NEW.issue_id;
  
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- Check if sufficient stock
  IF v_item_record.current_stock < NEW.quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock for item %. Available: %, Required: %', 
      v_item_record.name, v_item_record.current_stock, NEW.quantity_issued;
  END IF;
  
  -- Update item stock
  UPDATE store_items
  SET 
    current_stock = current_stock - NEW.quantity_issued,
    updated_at = NOW()
  WHERE id = NEW.item_id;
  
  -- Update batch if batch tracking
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE store_item_batches
    SET remaining_quantity = remaining_quantity - NEW.quantity_issued
    WHERE id = NEW.batch_id;
  END IF;
  
  -- Create stock movement record
  INSERT INTO store_stock_movements (
    movement_number,
    item_id,
    batch_id,
    movement_type,
    movement_date,
    quantity,
    unit_cost,
    total_value,
    stock_before,
    stock_after,
    from_location_id,
    to_department_id,
    reference_type,
    reference_id,
    reference_number,
    notes,
    performed_by_id
  ) VALUES (
    generate_movement_number(),
    NEW.item_id,
    NEW.batch_id,
    'issue',
    CURRENT_DATE,
    NEW.quantity_issued,
    NEW.unit_cost,
    NEW.total_value,
    v_item_record.current_stock,
    v_item_record.current_stock - NEW.quantity_issued,
    v_item_record.storage_location_id,
    v_issue_record.department_id,
    'issue',
    NEW.issue_id,
    v_issue_record.issue_number,
    'Stock issued to department',
    v_issue_record.issued_by_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_stock_issue_trigger
  AFTER UPDATE OF quantity_issued ON store_issue_items
  FOR EACH ROW
  WHEN (NEW.quantity_issued > OLD.quantity_issued)
  EXECUTE FUNCTION process_stock_issue();

-- Function to process stock return
CREATE OR REPLACE FUNCTION process_stock_return()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_return_record RECORD;
BEGIN
  -- Get return details
  SELECT * INTO v_return_record FROM store_stock_returns WHERE id = NEW.return_id;
  
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- Update item stock (only if condition is good)
  IF NEW.condition = 'good' THEN
    UPDATE store_items
    SET 
      current_stock = current_stock + NEW.quantity_returned,
      updated_at = NOW()
    WHERE id = NEW.item_id;
    
    -- Update batch if applicable
    IF NEW.batch_id IS NOT NULL THEN
      UPDATE store_item_batches
      SET remaining_quantity = remaining_quantity + NEW.quantity_returned
      WHERE id = NEW.batch_id;
    END IF;
    
    -- Create stock movement record
    INSERT INTO store_stock_movements (
      movement_number,
      item_id,
      batch_id,
      movement_type,
      movement_date,
      quantity,
      unit_cost,
      total_value,
      stock_before,
      stock_after,
      to_location_id,
      from_department_id,
      reference_type,
      reference_id,
      reference_number,
      notes,
      performed_by_id
    ) VALUES (
      generate_movement_number(),
      NEW.item_id,
      NEW.batch_id,
      'return',
      CURRENT_DATE,
      NEW.quantity_returned,
      NEW.unit_cost,
      NEW.total_value,
      v_item_record.current_stock,
      v_item_record.current_stock + NEW.quantity_returned,
      v_item_record.storage_location_id,
      v_return_record.department_id,
      'return',
      NEW.return_id,
      v_return_record.return_number,
      'Stock returned from department - ' || NEW.condition,
      v_return_record.received_by_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_stock_return_trigger
  AFTER INSERT ON store_return_items
  FOR EACH ROW
  EXECUTE FUNCTION process_stock_return();

-- Function to process stock transfer
CREATE OR REPLACE FUNCTION process_stock_transfer()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_transfer_record RECORD;
BEGIN
  -- Get transfer details
  SELECT * INTO v_transfer_record FROM store_stock_transfers WHERE id = NEW.transfer_id;
  
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- On dispatch: reduce stock from source
  IF v_transfer_record.status = 'in_transit' AND OLD.quantity_sent = 0 THEN
    -- Create outbound movement
    INSERT INTO store_stock_movements (
      movement_number,
      item_id,
      batch_id,
      movement_type,
      movement_date,
      quantity,
      unit_cost,
      total_value,
      stock_before,
      stock_after,
      from_location_id,
      to_location_id,
      reference_type,
      reference_id,
      reference_number,
      notes,
      performed_by_id
    ) VALUES (
      generate_movement_number(),
      NEW.item_id,
      NEW.batch_id,
      'transfer_out',
      CURRENT_DATE,
      NEW.quantity_sent,
      NEW.unit_cost,
      NEW.total_value,
      v_item_record.current_stock,
      v_item_record.current_stock - NEW.quantity_sent,
      v_transfer_record.from_location_id,
      v_transfer_record.to_location_id,
      'transfer',
      NEW.transfer_id,
      v_transfer_record.transfer_number,
      'Stock transferred out',
      v_transfer_record.dispatched_by_id
    );
  END IF;
  
  -- On receipt: add stock to destination
  IF NEW.quantity_received > OLD.quantity_received THEN
    INSERT INTO store_stock_movements (
      movement_number,
      item_id,
      batch_id,
      movement_type,
      movement_date,
      quantity,
      unit_cost,
      total_value,
      stock_before,
      stock_after,
      from_location_id,
      to_location_id,
      reference_type,
      reference_id,
      reference_number,
      notes,
      performed_by_id
    ) VALUES (
      generate_movement_number(),
      NEW.item_id,
      NEW.batch_id,
      'transfer_in',
      CURRENT_DATE,
      NEW.quantity_received - OLD.quantity_received,
      NEW.unit_cost,
      (NEW.quantity_received - OLD.quantity_received) * NEW.unit_cost,
      v_item_record.current_stock,
      v_item_record.current_stock + (NEW.quantity_received - OLD.quantity_received),
      v_transfer_record.from_location_id,
      v_transfer_record.to_location_id,
      'transfer',
      NEW.transfer_id,
      v_transfer_record.transfer_number,
      'Stock transferred in',
      v_transfer_record.received_by_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_stock_transfer_trigger
  AFTER INSERT OR UPDATE ON store_transfer_items
  FOR EACH ROW
  EXECUTE FUNCTION process_stock_transfer();

-- Function to process stock adjustment
CREATE OR REPLACE FUNCTION process_stock_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_adjustment_record RECORD;
  v_movement_type movement_type;
BEGIN
  -- Only process if adjustment is approved
  SELECT * INTO v_adjustment_record 
  FROM store_stock_adjustments 
  WHERE id = NEW.adjustment_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- Determine movement type
  IF NEW.variance_quantity > 0 THEN
    v_movement_type := 'adjustment_plus';
  ELSE
    v_movement_type := 'adjustment_minus';
  END IF;
  
  -- Update item stock
  UPDATE store_items
  SET 
    current_stock = NEW.actual_quantity,
    updated_at = NOW()
  WHERE id = NEW.item_id;
  
  -- Update batch if applicable
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE store_item_batches
    SET remaining_quantity = NEW.actual_quantity
    WHERE id = NEW.batch_id;
  END IF;
  
  -- Create stock movement record
  INSERT INTO store_stock_movements (
    movement_number,
    item_id,
    batch_id,
    movement_type,
    movement_date,
    quantity,
    unit_cost,
    total_value,
    stock_before,
    stock_after,
    reference_type,
    reference_id,
    reference_number,
    notes,
    performed_by_id
  ) VALUES (
    generate_movement_number(),
    NEW.item_id,
    NEW.batch_id,
    v_movement_type,
    CURRENT_DATE,
    ABS(NEW.variance_quantity),
    NEW.unit_cost,
    ABS(NEW.variance_value),
    NEW.system_quantity,
    NEW.actual_quantity,
    'adjustment',
    NEW.adjustment_id,
    v_adjustment_record.adjustment_number,
    'Stock adjustment - ' || v_adjustment_record.reason::TEXT,
    v_adjustment_record.approved_by_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_stock_adjustment_trigger
  AFTER INSERT OR UPDATE ON store_adjustment_items
  FOR EACH ROW
  EXECUTE FUNCTION process_stock_adjustment();

-- Function to update PO status based on received quantities
CREATE OR REPLACE FUNCTION update_po_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_ordered DECIMAL;
  v_total_received DECIMAL;
  v_po_id UUID;
BEGIN
  v_po_id := NEW.po_id;
  
  -- Calculate totals
  SELECT 
    SUM(quantity_ordered),
    SUM(quantity_received)
  INTO v_total_ordered, v_total_received
  FROM store_po_items
  WHERE po_id = v_po_id;
  
  -- Update PO status
  UPDATE store_purchase_orders
  SET 
    status = CASE
      WHEN v_total_received = 0 THEN status
      WHEN v_total_received >= v_total_ordered THEN 'fully_received'::po_status
      ELSE 'partially_received'::po_status
    END,
    actual_delivery_date = CASE
      WHEN v_total_received >= v_total_ordered THEN CURRENT_DATE
      ELSE actual_delivery_date
    END,
    updated_at = NOW()
  WHERE id = v_po_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_po_status_trigger
  AFTER UPDATE OF quantity_received ON store_po_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_status();

-- Function to update supplier performance on PO completion
CREATE OR REPLACE FUNCTION update_supplier_performance_on_po()
RETURNS TRIGGER AS $$
DECLARE
  v_on_time BOOLEAN;
  v_supplier_id UUID;
BEGIN
  IF NEW.status = 'fully_received' AND OLD.status != 'fully_received' THEN
    v_supplier_id := NEW.supplier_id;
    
    -- Check if delivery was on time
    v_on_time := NEW.actual_delivery_date <= NEW.expected_delivery_date;
    
    -- Update supplier metrics
    UPDATE store_suppliers
    SET 
      total_orders = total_orders + 1,
      total_purchase_value = total_purchase_value + NEW.total_amount,
      on_time_delivery_rate = (
        (on_time_delivery_rate * total_orders + CASE WHEN v_on_time THEN 100 ELSE 0 END) / 
        (total_orders + 1)
      ),
      last_order_date = NEW.po_date,
      updated_at = NOW()
    WHERE id = v_supplier_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_supplier_performance_trigger
  AFTER UPDATE OF status ON store_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_performance_on_po();

-- Function to calculate totals for GRN
CREATE OR REPLACE FUNCTION calculate_grn_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE store_grn
  SET 
    total_items = (SELECT COUNT(*) FROM store_grn_items WHERE grn_id = NEW.grn_id),
    total_quantity = (SELECT SUM(quantity_accepted) FROM store_grn_items WHERE grn_id = NEW.grn_id),
    total_value = (SELECT SUM(total_value) FROM store_grn_items WHERE grn_id = NEW.grn_id),
    updated_at = NOW()
  WHERE id = NEW.grn_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_grn_totals_trigger
  AFTER INSERT OR UPDATE ON store_grn_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_grn_totals();

-- Function to alert on low stock
CREATE OR REPLACE FUNCTION check_low_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock <= NEW.reorder_level THEN
    -- You can implement notification logic here
    -- For now, we'll just log it
    RAISE NOTICE 'Low stock alert for item %: Current stock % is at or below reorder level %',
      NEW.name, NEW.current_stock, NEW.reorder_level;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_low_stock_trigger
  AFTER UPDATE OF current_stock ON store_items
  FOR EACH ROW
  WHEN (NEW.current_stock <= NEW.reorder_level)
  EXECUTE FUNCTION check_low_stock_alert();

-- Function to check expiring items
CREATE OR REPLACE FUNCTION check_expiring_items()
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  batch_number TEXT,
  expiry_date DATE,
  days_to_expiry INTEGER,
  remaining_quantity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.id,
    si.name,
    sib.batch_number,
    sib.expiry_date,
    (sib.expiry_date - CURRENT_DATE)::INTEGER,
    sib.remaining_quantity
  FROM store_item_batches sib
  JOIN store_items si ON si.id = sib.item_id
  WHERE 
    sib.expiry_date IS NOT NULL
    AND sib.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND sib.remaining_quantity > 0
    AND NOT sib.is_expired
  ORDER BY sib.expiry_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get items below reorder level
CREATE OR REPLACE FUNCTION get_items_to_reorder()
RETURNS TABLE (
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  category item_category,
  current_stock DECIMAL,
  reorder_level DECIMAL,
  reorder_quantity DECIMAL,
  preferred_supplier_id UUID,
  preferred_supplier_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.id,
    si.item_code,
    si.name,
    si.category,
    si.current_stock,
    si.reorder_level,
    si.reorder_quantity,
    sis.supplier_id,
    ss.name
  FROM store_items si
  LEFT JOIN store_item_suppliers sis ON sis.item_id = si.id AND sis.is_preferred = true
  LEFT JOIN store_suppliers ss ON ss.id = sis.supplier_id
  WHERE 
    si.current_stock <= si.reorder_level
    AND si.is_active = true
    AND NOT si.is_discontinued
  ORDER BY si.category, si.name;
END;
$$ LANGUAGE plpgsql;
