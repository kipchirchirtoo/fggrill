-- Cashier shift logbook line evidence: the close-shift logbook generator
-- writes the payment method and the source record for each cleared line.
-- These columns were missing, causing shift-close logbook generation to fail
-- (PGRST204: "Could not find the 'payment_method' column ...").

ALTER TABLE cashier_logbook_lines
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_table VARCHAR(80),
  ADD COLUMN IF NOT EXISTS source_id TEXT;
