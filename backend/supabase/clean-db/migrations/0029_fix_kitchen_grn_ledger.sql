-- =============================================================
-- 0029: Fix kitchen GRN, ledger, and requisition schema gaps
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: kitchen_stock_ledger — add shift + user_id
-- createLedgerEntry inserts these columns
-- ---------------------------------------------------------------
ALTER TABLE kitchen_stock_ledger ADD COLUMN IF NOT EXISTS shift       TEXT;
ALTER TABLE kitchen_stock_ledger ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE kitchen_stock_ledger ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;

-- ---------------------------------------------------------------
-- FIX 2: kitchen_grn — add issued_by alias for received_by
-- fulfillRequisition inserts issued_by; table has received_by
-- ---------------------------------------------------------------
ALTER TABLE kitchen_grn ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill
UPDATE kitchen_grn SET issued_by = received_by WHERE issued_by IS NULL AND received_by IS NOT NULL;

-- Sync trigger
CREATE OR REPLACE FUNCTION sync_kitchen_grn_staff()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.received_by IS DISTINCT FROM OLD.received_by AND NEW.issued_by IS NULL THEN NEW.issued_by := NEW.received_by; END IF;
  IF NEW.issued_by IS DISTINCT FROM OLD.issued_by AND NEW.received_by IS NULL THEN NEW.received_by := NEW.issued_by; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_grn_staff ON kitchen_grn;
CREATE TRIGGER trg_sync_grn_staff
  BEFORE INSERT OR UPDATE ON kitchen_grn
  FOR EACH ROW EXECUTE FUNCTION sync_kitchen_grn_staff();

-- ---------------------------------------------------------------
-- FIX 3: kitchen_grn_items — add columns used by fulfillRequisition
-- Controller inserts: quantity, unit_of_measure, ledger_entry_id,
--                     menu_item_id, recipe_id
-- Table has:          quantity_received, unit
-- ---------------------------------------------------------------
ALTER TABLE kitchen_grn_items ADD COLUMN IF NOT EXISTS quantity        NUMERIC(12,4);
ALTER TABLE kitchen_grn_items ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;
ALTER TABLE kitchen_grn_items ADD COLUMN IF NOT EXISTS ledger_entry_id UUID;
ALTER TABLE kitchen_grn_items ADD COLUMN IF NOT EXISTS menu_item_id    UUID;
ALTER TABLE kitchen_grn_items ADD COLUMN IF NOT EXISTS recipe_id       UUID;

-- Backfill aliases
UPDATE kitchen_grn_items SET quantity = quantity_received WHERE quantity IS NULL AND quantity_received IS NOT NULL;
UPDATE kitchen_grn_items SET unit_of_measure = unit       WHERE unit_of_measure IS NULL AND unit IS NOT NULL;

-- Sync trigger
CREATE OR REPLACE FUNCTION sync_kitchen_grn_item_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity_received IS DISTINCT FROM OLD.quantity_received THEN NEW.quantity := NEW.quantity_received; END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN NEW.quantity_received := NEW.quantity; END IF;
  IF NEW.unit IS DISTINCT FROM OLD.unit THEN NEW.unit_of_measure := NEW.unit; END IF;
  IF NEW.unit_of_measure IS DISTINCT FROM OLD.unit_of_measure THEN NEW.unit := NEW.unit_of_measure; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_grn_item_qty ON kitchen_grn_items;
CREATE TRIGGER trg_sync_grn_item_qty
  BEFORE INSERT OR UPDATE ON kitchen_grn_items
  FOR EACH ROW EXECUTE FUNCTION sync_kitchen_grn_item_qty();

-- ---------------------------------------------------------------
-- FIX 4: kitchen_requisitions — add rejected_by column
-- rejectRequisition sets rejected_by; only approved_by exists
-- ---------------------------------------------------------------
ALTER TABLE kitchen_requisitions ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------
-- FIX 5: kitchen_requisition_items — backfill unit_of_measure
-- from unit after the column was added in 0028
-- ---------------------------------------------------------------
UPDATE kitchen_requisition_items SET unit_of_measure = unit WHERE unit_of_measure IS NULL AND unit IS NOT NULL;

-- ---------------------------------------------------------------
-- Reload PostgREST schema cache
-- ---------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
