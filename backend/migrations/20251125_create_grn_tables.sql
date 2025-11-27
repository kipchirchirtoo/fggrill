-- Create GRN tables
CREATE TABLE IF NOT EXISTS goods_received_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id) NOT NULL,
  supplier_invoice_number VARCHAR(100),
  delivery_note_number VARCHAR(100),
  received_date TIMESTAMPTZ DEFAULT NOW(),
  received_by UUID REFERENCES users(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'completed', -- completed, verified
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grn_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id UUID REFERENCES goods_received_notes(id) ON DELETE CASCADE NOT NULL,
  po_item_id UUID REFERENCES purchase_order_items(id) NOT NULL,
  item_id INTEGER REFERENCES inventory_items(id) NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_rejected INTEGER DEFAULT 0,
  rejection_reason TEXT,
  batch_number VARCHAR(50),
  expiry_date DATE,
  manufacturing_date DATE,
  unit_price DECIMAL(10,2), -- Capturing price at receipt time
  total_price DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to generate GRN number
CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  month TEXT;
  counter INT;
  grn_num TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  SELECT COALESCE(MAX(SUBSTRING(grn_number FROM '\d+$')::INT), 0) + 1
  INTO counter
  FROM goods_received_notes
  WHERE grn_number LIKE 'GRN-' || year || month || '-%';
  
  grn_num := 'GRN-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN grn_num;
END;
$$ LANGUAGE plpgsql;

-- Update trigger for GRN
DO $$ 
BEGIN
  CREATE TRIGGER update_grn_updated_at
    BEFORE UPDATE ON goods_received_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
