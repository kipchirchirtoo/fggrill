-- Add custom deduction amount columns to staff_profiles for per-employee policy rates

ALTER TABLE staff_profiles
    ADD COLUMN IF NOT EXISTS nssf_amount NUMERIC(12,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS shif_amount NUMERIC(12,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS housing_fund_amount NUMERIC(12,2) DEFAULT NULL;
