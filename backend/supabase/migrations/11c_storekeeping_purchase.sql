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
