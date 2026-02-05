-- =====================================================
-- FIX AMBIGUOUS COLUMN REFERENCE IN PO UPDATE
-- Corrects update_po_item_from_grn function
-- =====================================================

CREATE OR REPLACE FUNCTION update_po_item_from_grn()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update PO items if GRN is approved
  IF NEW.grn_approved = true AND (OLD.grn_approved IS NULL OR OLD.grn_approved = false) THEN
    -- Update all PO items linked to this GRN
    UPDATE store_po_items poi
    SET 
      quantity_received = poi.quantity_received + COALESCE(gi.accepted_quantity, 0),
      quantity_pending = poi.quantity_ordered - (poi.quantity_received + COALESCE(gi.accepted_quantity, 0)),
      quantity_rejected = poi.quantity_rejected + COALESCE(gi.rejected_quantity, 0) + COALESCE(gi.damaged_quantity, 0),
      updated_at = NOW()
    FROM store_grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.po_item_id = poi.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
