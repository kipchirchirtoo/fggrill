-- 20251224_create_procurement_schema.sql
-- Creates tables for the procurement module

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(50),
  payment_terms VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(20) UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  receiving_branch_id INTEGER REFERENCES branches(id),
  status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SENT, PARTIAL, RECEIVED, COMPLETED, CANCELLED
  
  -- Financials
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  shipping_cost DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Dates
  expected_delivery DATE,
  actual_delivery DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  
  -- People
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  received_by UUID REFERENCES users(id),
  
  -- Notes
  order_notes TEXT,
  delivery_notes TEXT
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) REFERENCES inventory_items(sku),
  
  -- Quantities
  ordered_quantity INTEGER NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  
  -- Costs
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PARTIAL, RECEIVED
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Function to generate PO number
DROP FUNCTION IF EXISTS get_next_po_number();
CREATE OR REPLACE FUNCTION get_next_po_number() RETURNS text AS $$
DECLARE
  _date text;
  _count int;
  _po_number text;
BEGIN
  _date := to_char(now(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO _count FROM purchase_orders WHERE po_number LIKE 'PO-' || _date || '-%';
  _po_number := 'PO-' || _date || '-' || lpad(_count::text, 3, '0');
  RETURN _po_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update branch stock (helper for receiving POs)
DROP FUNCTION IF EXISTS update_branch_stock(INTEGER, VARCHAR, INTEGER);
CREATE OR REPLACE FUNCTION update_branch_stock(
  p_branch_id INTEGER,
  p_item_sku VARCHAR,
  p_quantity_change INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO branch_stock (branch_id, item_sku, quantity, updated_at)
  VALUES (p_branch_id, p_item_sku, p_quantity_change, NOW())
  ON CONFLICT (branch_id, item_sku)
  DO UPDATE SET
    quantity = branch_stock.quantity + p_quantity_change,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
