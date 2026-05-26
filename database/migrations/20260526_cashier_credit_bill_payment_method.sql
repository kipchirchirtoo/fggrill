-- Cashier credit-bill payment method support.
-- Links cashier/POS payments to credit_bills so a cashier can settle a bill by
-- creating a staff/customer credit bill while keeping payment, POS, and logbook
-- records auditable.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'credit_bill';
  END IF;
END $$;

ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS credit_bill_id UUID;

ALTER TABLE IF EXISTS pos_transactions
  ADD COLUMN IF NOT EXISTS credit_bill_id UUID;

ALTER TABLE IF EXISTS cashier_transactions
  ADD COLUMN IF NOT EXISTS credit_bill_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credit_bills'
  ) THEN
    ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS payments_credit_bill_id_fkey;
    ALTER TABLE payments
      ADD CONSTRAINT payments_credit_bill_id_fkey
      FOREIGN KEY (credit_bill_id) REFERENCES credit_bills(id) ON DELETE SET NULL;

    ALTER TABLE pos_transactions
      DROP CONSTRAINT IF EXISTS pos_transactions_credit_bill_id_fkey;
    ALTER TABLE pos_transactions
      ADD CONSTRAINT pos_transactions_credit_bill_id_fkey
      FOREIGN KEY (credit_bill_id) REFERENCES credit_bills(id) ON DELETE SET NULL;

    ALTER TABLE cashier_transactions
      DROP CONSTRAINT IF EXISTS cashier_transactions_credit_bill_id_fkey;
    ALTER TABLE cashier_transactions
      ADD CONSTRAINT cashier_transactions_credit_bill_id_fkey
      FOREIGN KEY (credit_bill_id) REFERENCES credit_bills(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_credit_bill_id
  ON payments(credit_bill_id);

CREATE INDEX IF NOT EXISTS idx_pos_transactions_credit_bill_id
  ON pos_transactions(credit_bill_id);

CREATE INDEX IF NOT EXISTS idx_cashier_transactions_credit_bill_id
  ON cashier_transactions(credit_bill_id);

COMMENT ON COLUMN payments.credit_bill_id IS
  'Credit bill created when a cashier payment is settled through staff/customer credit.';
COMMENT ON COLUMN pos_transactions.credit_bill_id IS
  'Credit bill linked to this POS transaction when payment_method is CREDIT_BILL.';
COMMENT ON COLUMN cashier_transactions.credit_bill_id IS
  'Credit bill linked to the cashier logbook transaction.';
