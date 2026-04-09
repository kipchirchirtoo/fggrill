ALTER TABLE unpaid_bills
ADD COLUMN IF NOT EXISTS scan_reference VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS unpaid_bills_scan_reference_idx
ON unpaid_bills (scan_reference)
WHERE scan_reference IS NOT NULL;

UPDATE unpaid_bills
SET scan_reference = 'CCB-' || upper(regexp_replace(COALESCE(bill_number, id::text), '[^A-Za-z0-9]', '', 'g'))
WHERE scan_reference IS NULL;
