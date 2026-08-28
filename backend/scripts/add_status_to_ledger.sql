-- Add status and submitted_at columns to kitchen_ledger_entries
ALTER TABLE kitchen_ledger_entries 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
