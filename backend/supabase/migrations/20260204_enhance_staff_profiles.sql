-- Migration to enhance staff_profiles with enterprise-level fields
-- Targets: KRA, NSSF, SHIF, Banking, and Employment details

ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS kra_pin TEXT,
ADD COLUMN IF NOT EXISTS nssf_number TEXT,
ADD COLUMN IF NOT EXISTS nhif_number TEXT, -- Backward compatibility
ADD COLUMN IF NOT EXISTS shif_number TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_branch TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS mpesa_number TEXT,
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'contract', 'casual')),
ADD COLUMN IF NOT EXISTS contract_expiry DATE,
ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT,
ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT,
ADD COLUMN IF NOT EXISTS next_of_kin_relationship TEXT;

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_staff_profiles_kra_pin ON staff_profiles(kra_pin);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_nssf_number ON staff_profiles(nssf_number);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_shif_number ON staff_profiles(shif_number);
