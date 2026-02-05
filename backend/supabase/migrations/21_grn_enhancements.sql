-- =====================================================
-- GRN (Goods Received Note) ENHANCEMENTS
-- Adds item condition tracking and quality inspection
-- =====================================================

-- Create item condition enum
DO $$ BEGIN
  CREATE TYPE item_condition_status AS ENUM (
    'good',
    'damaged',
    'short',
    'expired',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enhance store_grn table
ALTER TABLE store_grn
  ADD COLUMN IF NOT EXISTS grn_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS quality_inspector_notes TEXT,
  ADD COLUMN IF NOT EXISTS supporting_documents JSONB DEFAULT '[]'::jsonb;

-- Enhance store_grn_items table with condition tracking
ALTER TABLE store_grn_items
  ADD COLUMN IF NOT EXISTS condition_status item_condition_status DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS accepted_quantity DECIMAL(12, 3),
  ADD COLUMN IF NOT EXISTS rejected_quantity DECIMAL(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity DECIMAL(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_quantity DECIMAL(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_quantity DECIMAL(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS damage_notes TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date_found DATE,
  ADD COLUMN IF NOT EXISTS quality_inspector_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS quality_inspection_date TIMESTAMP WITH TIME ZONE;

-- Add constraint: accepted + rejected + damaged + short + expired = received
ALTER TABLE store_grn_items
  DROP CONSTRAINT IF EXISTS valid_grn_item_quantities,
  ADD CONSTRAINT valid_grn_item_quantities CHECK (
    quantity_received > 0 AND
    quantity_accepted >= 0 AND
    quantity_rejected >= 0 AND
    quantity_damaged >= 0 AND
    accepted_quantity >= 0 AND
    rejected_quantity >= 0 AND
    damaged_quantity >= 0 AND
    short_quantity >= 0 AND
    expired_quantity >= 0 AND
    (accepted_quantity + rejected_quantity + damaged_quantity + short_quantity + expired_quantity) = quantity_received
  );

-- Enhance store_purchase_orders with delivery tracking
ALTER TABLE store_purchase_orders
  ADD COLUMN IF NOT EXISTS delivery_date_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_window_start DATE,
  ADD COLUMN IF NOT EXISTS delivery_window_end DATE,
  ADD COLUMN IF NOT EXISTS payment_terms_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_grn BOOLEAN DEFAULT true;

-- Add constraint for delivery window
ALTER TABLE store_purchase_orders
  ADD CONSTRAINT valid_delivery_window CHECK (
    delivery_window_end IS NULL OR 
    delivery_window_start IS NULL OR 
    delivery_window_end >= delivery_window_start
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_store_grn_approved ON store_grn(grn_approved);
CREATE INDEX IF NOT EXISTS idx_store_grn_approved_by ON store_grn(approved_by_id);
CREATE INDEX IF NOT EXISTS idx_store_grn_items_condition ON store_grn_items(condition_status);
CREATE INDEX IF NOT EXISTS idx_store_grn_items_inspector ON store_grn_items(quality_inspector_id);

-- Function to auto-calculate accepted quantity based on condition
CREATE OR REPLACE FUNCTION calculate_grn_item_accepted_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only items marked as 'good' are accepted
  IF NEW.condition_status = 'good' THEN
    NEW.accepted_quantity := NEW.quantity_received - NEW.rejected_quantity - NEW.damaged_quantity - NEW.short_quantity - NEW.expired_quantity;
  ELSE
    NEW.accepted_quantity := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-calculation
DROP TRIGGER IF EXISTS calculate_grn_item_accepted_quantity_trigger ON store_grn_items;
CREATE TRIGGER calculate_grn_item_accepted_quantity_trigger
  BEFORE INSERT OR UPDATE ON store_grn_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_grn_item_accepted_quantity();

-- Function to update PO item received quantities only from approved GRNs
CREATE OR REPLACE FUNCTION update_po_item_from_grn()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update PO items if GRN is approved
  IF NEW.grn_approved = true AND (OLD.grn_approved IS NULL OR OLD.grn_approved = false) THEN
    -- Update all PO items linked to this GRN
    UPDATE store_po_items poi
    SET 
      quantity_received = quantity_received + COALESCE(gi.accepted_quantity, 0),
      quantity_pending = quantity_ordered - (quantity_received + COALESCE(gi.accepted_quantity, 0)),
      quantity_rejected = quantity_rejected + COALESCE(gi.rejected_quantity, 0) + COALESCE(gi.damaged_quantity, 0),
      updated_at = NOW()
    FROM store_grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.po_item_id = poi.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update PO items on GRN approval
DROP TRIGGER IF EXISTS update_po_item_from_grn_trigger ON store_grn;
CREATE TRIGGER update_po_item_from_grn_trigger
  AFTER UPDATE OF grn_approved ON store_grn
  FOR EACH ROW
  EXECUTE FUNCTION update_po_item_from_grn();

COMMENT ON COLUMN store_grn.grn_approved IS 'Whether GRN has been approved - only approved GRNs update inventory';
COMMENT ON COLUMN store_grn.approved_by_id IS 'User who approved the GRN';
COMMENT ON COLUMN store_grn.approved_at IS 'Timestamp when GRN was approved';
COMMENT ON COLUMN store_grn_items.condition_status IS 'Condition of received items: good, damaged, short, expired, rejected';
COMMENT ON COLUMN store_grn_items.accepted_quantity IS 'Quantity accepted and added to inventory (auto-calculated)';
COMMENT ON COLUMN store_grn_items.rejected_quantity IS 'Quantity rejected due to quality issues';
COMMENT ON COLUMN store_grn_items.damaged_quantity IS 'Quantity received damaged';
COMMENT ON COLUMN store_grn_items.short_quantity IS 'Quantity short (less than ordered)';
COMMENT ON COLUMN store_grn_items.expired_quantity IS 'Quantity received expired';
