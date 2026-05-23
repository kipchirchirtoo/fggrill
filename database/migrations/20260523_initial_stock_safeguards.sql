-- =============================================================================
-- INITIAL STOCK SAFEGUARDS & DOCUMENTATION
-- Ensures initial stock workflow is properly enforced and auditable
-- =============================================================================

BEGIN;

-- 1. Prevent negative quantities in simple_items
ALTER TABLE simple_items 
ADD CONSTRAINT chk_simple_items_quantity_non_negative 
CHECK (quantity >= 0);

-- 2. Add CHECK constraint for valid stock_history reasons
ALTER TABLE stock_history 
ADD CONSTRAINT chk_stock_history_reason_valid 
CHECK (reason IN (
  'INITIAL_STOCK',
  'REACTIVATION',
  'PURCHASE',
  'GRN',
  'DISPATCH',
  'RECEIPT',
  'ADJUSTMENT',
  'TRANSFER',
  'SPOILAGE',
  'EXPIRED',
  'DAMAGE',
  'USAGE',
  'SALE',
  'RETURN',
  'CORRECTION'
));

-- 3. Add index on stock_history.reason for filtering initial stock entries
CREATE INDEX IF NOT EXISTS idx_stock_history_reason ON stock_history(reason);

-- 4. Add index on stock_history.reference for order number lookups
CREATE INDEX IF NOT EXISTS idx_stock_history_reference ON stock_history(reference);

-- 5. Document the initial stock workflow
COMMENT ON TABLE simple_items IS 'Central inventory catalog. quantity field can be set on item creation for initial stock, which triggers a stock_history entry with reason=INITIAL_STOCK. Subsequent stock changes must go through receiving/GRN, dispatch, or adjustment workflows.';
COMMENT ON COLUMN stock_history.reason IS 'Reason for stock movement. INITIAL_STOCK is used when quantity > 0 on item creation. REACTIVATION is used when reactivating a previously deleted item with new stock.';
COMMENT ON COLUMN stock_history.reference IS 'Order number or reference document (e.g., STKIN-XXXXX for initial stock, PO-XXXXX for purchase orders, DN-XXXXX for dispatch notes)';

COMMIT;
