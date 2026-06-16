-- =============================================================
-- 0028: Fix dispatch + kitchen storekeeper flow gaps
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: dispatch_otps — add columns expected by dispatches.controller.ts
-- Controller queries driver_otp, branch_otp, driver_otp_used_at,
-- branch_otp_used_at, is_used
-- ---------------------------------------------------------------
ALTER TABLE dispatch_otps ADD COLUMN IF NOT EXISTS driver_otp          TEXT;
ALTER TABLE dispatch_otps ADD COLUMN IF NOT EXISTS branch_otp          TEXT;
ALTER TABLE dispatch_otps ADD COLUMN IF NOT EXISTS driver_otp_used_at  TIMESTAMPTZ;
ALTER TABLE dispatch_otps ADD COLUMN IF NOT EXISTS branch_otp_used_at  TIMESTAMPTZ;
ALTER TABLE dispatch_otps ADD COLUMN IF NOT EXISTS is_used             BOOLEAN DEFAULT FALSE;

-- Backfill from existing otp_code: treat as driver_otp by default
UPDATE dispatch_otps SET driver_otp = otp_code WHERE driver_otp IS NULL AND otp_code IS NOT NULL;
UPDATE dispatch_otps SET is_used = used         WHERE is_used IS FALSE AND used IS TRUE;

-- Keep is_used / used in sync
CREATE OR REPLACE FUNCTION sync_dispatch_otp_used()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.used IS DISTINCT FROM OLD.used THEN NEW.is_used := NEW.used; END IF;
  IF NEW.is_used IS DISTINCT FROM OLD.is_used THEN NEW.used := NEW.is_used; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_otp_used ON dispatch_otps;
CREATE TRIGGER trg_sync_otp_used
  BEFORE INSERT OR UPDATE ON dispatch_otps
  FOR EACH ROW EXECUTE FUNCTION sync_dispatch_otp_used();

-- ---------------------------------------------------------------
-- FIX 2: dispatches table — add status-transition timestamp columns
-- Controller sets in_transit_at, branch_otp_verified_at, completed_at
-- ---------------------------------------------------------------
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS in_transit_at            TIMESTAMPTZ;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS branch_otp_verified_at   TIMESTAMPTZ;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS completed_at              TIMESTAMPTZ;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS from_branch_id            INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS to_branch_id              INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS created_by                UUID   REFERENCES users(id) ON DELETE SET NULL;

-- Backfill aliases
UPDATE dispatches SET from_branch_id = source_branch_id      WHERE from_branch_id IS NULL AND source_branch_id IS NOT NULL;
UPDATE dispatches SET to_branch_id   = destination_branch_id WHERE to_branch_id   IS NULL AND destination_branch_id IS NOT NULL;

-- Sync aliases on write
CREATE OR REPLACE FUNCTION sync_dispatch_branch_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_branch_id IS DISTINCT FROM OLD.source_branch_id      THEN NEW.from_branch_id := NEW.source_branch_id; END IF;
  IF NEW.from_branch_id   IS DISTINCT FROM OLD.from_branch_id         THEN NEW.source_branch_id := NEW.from_branch_id; END IF;
  IF NEW.destination_branch_id IS DISTINCT FROM OLD.destination_branch_id THEN NEW.to_branch_id := NEW.destination_branch_id; END IF;
  IF NEW.to_branch_id IS DISTINCT FROM OLD.to_branch_id              THEN NEW.destination_branch_id := NEW.to_branch_id; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_dispatch_branch_ids ON dispatches;
CREATE TRIGGER trg_sync_dispatch_branch_ids
  BEFORE INSERT OR UPDATE ON dispatches
  FOR EACH ROW EXECUTE FUNCTION sync_dispatch_branch_ids();

-- ---------------------------------------------------------------
-- FIX 3: store_dispatches VIEW (needed by otp.controller.ts &
-- tracking.controller.ts which query store_dispatches table)
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW store_dispatches AS
SELECT
  id, dispatch_number, status,
  source_branch_id, destination_branch_id,
  from_branch_id, to_branch_id,
  vehicle_id, driver_id, driver_phone,
  in_transit_at, dispatched_at, received_at,
  branch_otp_verified_at, completed_at,
  vehicle_info, courier_info, notes,
  created_by, dispatched_by, received_by,
  created_at, updated_at
FROM dispatches;

-- ---------------------------------------------------------------
-- FIX 4: dispatch_items — add accepted_quantity + receipt_status
-- branch-inventory.service.ts confirmDelivery uses these
-- ---------------------------------------------------------------
ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS accepted_quantity NUMERIC(12,4) DEFAULT 0;
ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS receipt_status    TEXT DEFAULT 'pending';

UPDATE dispatch_items SET accepted_quantity = received_quantity WHERE accepted_quantity = 0 AND received_quantity > 0;

-- ---------------------------------------------------------------
-- FIX 5: dispatch_documents — CREATE (missing)
-- dispatch/dispatches.controller.ts:uploadDocument / getDocuments
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispatch_documents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispatch_id     UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  document_type   TEXT DEFAULT 'stock_sheet' CHECK (document_type IN ('stock_sheet','delivery_note','invoice','photo','other')),
  document_url    TEXT NOT NULL,
  file_name       TEXT,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_documents_dispatch ON dispatch_documents(dispatch_id);

-- ---------------------------------------------------------------
-- FIX 6: dispatch_audit_log — CREATE (missing)
-- dispatches.controller.ts inserts audit records here
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispatch_audit_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispatch_id  UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  details      JSONB,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_audit_dispatch ON dispatch_audit_log(dispatch_id);

-- ---------------------------------------------------------------
-- FIX 7: pos_barcodes — CREATE (missing)
-- dispatch/pos.controller.ts uses this table
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_barcodes (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID,
  order_id       UUID,
  bill_id        UUID,
  branch_id      INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  barcode_value  TEXT UNIQUE NOT NULL,
  scanned        BOOLEAN DEFAULT FALSE,
  scanned_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_barcodes_value   ON pos_barcodes(barcode_value);
CREATE INDEX IF NOT EXISTS idx_pos_barcodes_branch  ON pos_barcodes(branch_id);

-- ---------------------------------------------------------------
-- FIX 8: item_barcodes — CREATE (missing)
-- dispatch/items.controller.ts uses this table
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_barcodes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id       UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  barcode_value TEXT UNIQUE NOT NULL,
  is_primary    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_item_barcodes_value ON item_barcodes(barcode_value);
CREATE INDEX IF NOT EXISTS idx_item_barcodes_item  ON item_barcodes(item_id);

-- ---------------------------------------------------------------
-- FIX 9: kitchen_requisitions — add requisition_number alias
-- Frontend uses requisition_number; table only has request_number
-- ---------------------------------------------------------------
ALTER TABLE kitchen_requisitions ADD COLUMN IF NOT EXISTS requisition_number TEXT;
ALTER TABLE kitchen_requisitions ADD COLUMN IF NOT EXISTS priority           TEXT DEFAULT 'NORMAL';
ALTER TABLE kitchen_requisitions ADD COLUMN IF NOT EXISTS reason             TEXT;
ALTER TABLE kitchen_requisitions ADD COLUMN IF NOT EXISTS requested_at       TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE kitchen_requisitions ADD COLUMN IF NOT EXISTS rejection_reason   TEXT;

-- Backfill
UPDATE kitchen_requisitions SET requisition_number = request_number     WHERE requisition_number IS NULL AND request_number IS NOT NULL;
UPDATE kitchen_requisitions SET requested_at = created_at               WHERE requested_at IS NULL;

-- Sync trigger
CREATE OR REPLACE FUNCTION sync_kitchen_req_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS DISTINCT FROM OLD.request_number THEN NEW.requisition_number := NEW.request_number; END IF;
  IF NEW.requisition_number IS DISTINCT FROM OLD.requisition_number THEN NEW.request_number := NEW.requisition_number; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_kitchen_req_number ON kitchen_requisitions;
CREATE TRIGGER trg_sync_kitchen_req_number
  BEFORE INSERT OR UPDATE ON kitchen_requisitions
  FOR EACH ROW EXECUTE FUNCTION sync_kitchen_req_number();

-- ---------------------------------------------------------------
-- FIX 10: kitchen_requisition_items — add issued_quantity + unit_of_measure alias
-- fulfillRequisition records issued quantity per item
-- ---------------------------------------------------------------
ALTER TABLE kitchen_requisition_items ADD COLUMN IF NOT EXISTS issued_quantity NUMERIC(12,4) DEFAULT 0;
ALTER TABLE kitchen_requisition_items ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;
ALTER TABLE kitchen_requisition_items ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

-- Backfill unit_of_measure from unit
UPDATE kitchen_requisition_items SET unit_of_measure = unit WHERE unit_of_measure IS NULL AND unit IS NOT NULL;

-- ---------------------------------------------------------------
-- FIX 11: kitchen_usage_records — add breakdown columns
-- Frontend KitchenUsage interface expects:
--   remaining_quantity, consumed_quantity, spoilt_quantity,
--   lost_quantity, damaged_quantity
-- These are computed from kitchen_usage_entries
-- ---------------------------------------------------------------
ALTER TABLE kitchen_usage_records ADD COLUMN IF NOT EXISTS remaining_quantity NUMERIC(12,4) DEFAULT 0;
ALTER TABLE kitchen_usage_records ADD COLUMN IF NOT EXISTS consumed_quantity  NUMERIC(12,4) DEFAULT 0;
ALTER TABLE kitchen_usage_records ADD COLUMN IF NOT EXISTS spoilt_quantity    NUMERIC(12,4) DEFAULT 0;
ALTER TABLE kitchen_usage_records ADD COLUMN IF NOT EXISTS lost_quantity      NUMERIC(12,4) DEFAULT 0;
ALTER TABLE kitchen_usage_records ADD COLUMN IF NOT EXISTS damaged_quantity   NUMERIC(12,4) DEFAULT 0;
ALTER TABLE kitchen_usage_records ADD COLUMN IF NOT EXISTS item_name          TEXT;

-- Trigger to recompute from usage entries on insert/update/delete
CREATE OR REPLACE FUNCTION recompute_kitchen_usage_totals()
RETURNS TRIGGER AS $$
DECLARE
  rec_id UUID;
BEGIN
  rec_id := COALESCE(NEW.usage_record_id, OLD.usage_record_id);
  UPDATE kitchen_usage_records r
  SET
    consumed_quantity = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND reason = 'consumed'),0),
    spoilt_quantity   = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND reason IN ('spoilt','spoiled')),0),
    lost_quantity     = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND reason = 'lost'),0),
    damaged_quantity  = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND reason = 'damaged'),0),
    remaining_quantity = r.received_quantity - COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id),0)
  WHERE r.id = rec_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recompute_usage_totals ON kitchen_usage_entries;
CREATE TRIGGER trg_recompute_usage_totals
  AFTER INSERT OR UPDATE OR DELETE ON kitchen_usage_entries
  FOR EACH ROW EXECUTE FUNCTION recompute_kitchen_usage_totals();

-- Initialise remaining_quantity from received_quantity for existing records
UPDATE kitchen_usage_records SET remaining_quantity = received_quantity WHERE remaining_quantity = 0 AND received_quantity > 0;

-- ---------------------------------------------------------------
-- FIX 12: dispatch_lines — add item_sku for direct lookup
-- branch-inventory.service.ts getIncomingDispatches joins
-- dispatch_lines with inventory_items to get item_sku
-- ---------------------------------------------------------------
ALTER TABLE dispatch_lines ADD COLUMN IF NOT EXISTS item_sku TEXT;

-- Backfill from inventory_items join
UPDATE dispatch_lines dl
SET item_sku = ii.sku
FROM inventory_items ii
WHERE dl.item_id = ii.id AND dl.item_sku IS NULL;

-- ---------------------------------------------------------------
-- Reload PostgREST schema cache
-- ---------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
