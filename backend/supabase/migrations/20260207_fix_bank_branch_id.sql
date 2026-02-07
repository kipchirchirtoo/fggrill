-- Migration to fix missing branch_id columns in bank-related tables
ALTER TABLE accounting_bank_accounts ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE accounting_bank_transactions ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounting_bank_accounts_branch ON accounting_bank_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_accounting_bank_transactions_branch ON accounting_bank_transactions(branch_id);
