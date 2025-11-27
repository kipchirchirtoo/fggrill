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
