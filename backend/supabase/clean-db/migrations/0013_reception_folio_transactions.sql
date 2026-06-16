-- =============================================================
-- 0013: Reception Module - Folio balance fix + transactions table
-- Folio model reads data.balance but DB has balance_due.
-- Creates folio line-items table (transactions).
-- =============================================================

-- Add balance as alias column so both balance_due and balance work
ALTER TABLE folios ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) DEFAULT 0;

-- Backfill balance from existing balance_due
UPDATE folios SET balance = balance_due WHERE balance = 0;

-- Create trigger to keep balance in sync with balance_due
CREATE OR REPLACE FUNCTION sync_folio_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance := NEW.balance_due;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_folio_balance ON folios;
CREATE TRIGGER trg_sync_folio_balance
  BEFORE INSERT OR UPDATE OF balance_due ON folios
  FOR EACH ROW EXECUTE FUNCTION sync_folio_balance();

-- =============================================================
-- Folio line-items (charges, payments, refunds, adjustments)
-- Used by Folio.getTransactions() and Folio.addTransaction()
-- =============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folio_id         UUID NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('charge','payment','refund','adjustment')),
  category         TEXT NOT NULL DEFAULT 'general',
  amount           NUMERIC(12,2) NOT NULL,
  description      TEXT,
  reference_number TEXT,
  performed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_folio ON transactions(folio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type  ON transactions(type);

-- Trigger: recalculate folio totals after each transaction insert/update/delete
CREATE OR REPLACE FUNCTION recalc_folio_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_folio_id UUID;
  v_total_charges  NUMERIC(12,2);
  v_total_payments NUMERIC(12,2);
BEGIN
  v_folio_id := COALESCE(NEW.folio_id, OLD.folio_id);

  SELECT
    COALESCE(SUM(CASE WHEN type IN ('charge') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('payment','refund') THEN ABS(amount) ELSE 0 END), 0)
  INTO v_total_charges, v_total_payments
  FROM transactions
  WHERE folio_id = v_folio_id;

  UPDATE folios
  SET
    total_charges  = v_total_charges,
    total_payments = v_total_payments,
    balance_due    = v_total_charges - v_total_payments,
    balance        = v_total_charges - v_total_payments,
    updated_at     = NOW()
  WHERE id = v_folio_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_folio_totals ON transactions;
CREATE TRIGGER trg_recalc_folio_totals
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION recalc_folio_totals();
