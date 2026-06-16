-- =============================================================
-- 0030: Fix kitchen_usage_entries + usage_records schema gaps
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: kitchen_usage_entries — add columns used by recordUsageEntry
-- Controller inserts: usage_type, produced_item, portions_produced, recorded_by
-- Table has: reason (maps to usage_type), no produced_item etc.
-- ---------------------------------------------------------------
ALTER TABLE kitchen_usage_entries ADD COLUMN IF NOT EXISTS usage_type         TEXT;
ALTER TABLE kitchen_usage_entries ADD COLUMN IF NOT EXISTS produced_item       TEXT;
ALTER TABLE kitchen_usage_entries ADD COLUMN IF NOT EXISTS portions_produced   NUMERIC(12,4);
ALTER TABLE kitchen_usage_entries ADD COLUMN IF NOT EXISTS recorded_by         UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE kitchen_usage_entries ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- Backfill usage_type from reason
UPDATE kitchen_usage_entries SET usage_type = UPPER(reason) WHERE usage_type IS NULL AND reason IS NOT NULL;
-- Backfill reason from usage_type (lowercase)
UPDATE kitchen_usage_entries SET reason = LOWER(usage_type) WHERE reason IS NULL AND usage_type IS NOT NULL;

-- Sync trigger: keep usage_type and reason in sync (one uppercase, one lowercase)
CREATE OR REPLACE FUNCTION sync_usage_entry_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.usage_type IS DISTINCT FROM OLD.usage_type THEN
    NEW.reason := LOWER(NEW.usage_type);
  END IF;
  IF NEW.reason IS DISTINCT FROM OLD.reason THEN
    NEW.usage_type := UPPER(NEW.reason);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_usage_entry_type ON kitchen_usage_entries;
CREATE TRIGGER trg_sync_usage_entry_type
  BEFORE INSERT OR UPDATE ON kitchen_usage_entries
  FOR EACH ROW EXECUTE FUNCTION sync_usage_entry_type();

-- ---------------------------------------------------------------
-- FIX 2: kitchen_usage_records — add expired_quantity, returned_quantity
-- recordUsageEntry reads these columns after entry is created
-- ---------------------------------------------------------------
ALTER TABLE kitchen_usage_records ADD COLUMN IF NOT EXISTS expired_quantity   NUMERIC(12,4) DEFAULT 0;
ALTER TABLE kitchen_usage_records ADD COLUMN IF NOT EXISTS returned_quantity  NUMERIC(12,4) DEFAULT 0;

-- ---------------------------------------------------------------
-- FIX 3: rebuild trigger that recomputes usage totals
-- Old trigger in 0028 used reason='consumed' but controller uses usage_type='CONSUMED'
-- Now we sum by usage_type (uppercase) OR reason (lowercase) for backward compat
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_kitchen_usage_totals()
RETURNS TRIGGER AS $$
DECLARE
  rec_id UUID;
BEGIN
  rec_id := COALESCE(NEW.usage_record_id, OLD.usage_record_id);
  UPDATE kitchen_usage_records r
  SET
    consumed_quantity  = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND (UPPER(COALESCE(usage_type, reason)) = 'CONSUMED')),0),
    spoilt_quantity    = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND (UPPER(COALESCE(usage_type, reason)) IN ('SPOILT','SPOILED'))),0),
    lost_quantity      = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND (UPPER(COALESCE(usage_type, reason)) = 'LOST')),0),
    damaged_quantity   = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND (UPPER(COALESCE(usage_type, reason)) = 'DAMAGED')),0),
    expired_quantity   = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND (UPPER(COALESCE(usage_type, reason)) = 'EXPIRED')),0),
    returned_quantity  = COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id AND (UPPER(COALESCE(usage_type, reason)) = 'RETURNED')),0),
    remaining_quantity = r.received_quantity - COALESCE((SELECT SUM(quantity) FROM kitchen_usage_entries WHERE usage_record_id = rec_id),0)
  WHERE r.id = rec_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger (replace old one)
DROP TRIGGER IF EXISTS trg_recompute_usage_totals ON kitchen_usage_entries;
CREATE TRIGGER trg_recompute_usage_totals
  AFTER INSERT OR UPDATE OR DELETE ON kitchen_usage_entries
  FOR EACH ROW EXECUTE FUNCTION recompute_kitchen_usage_totals();

-- ---------------------------------------------------------------
-- Reload PostgREST schema cache
-- ---------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
