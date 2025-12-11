-- Cleanup Compliance Data
-- Run this to remove excess mock data from compliance tables

-- Delete all branch compliance records
DELETE FROM branch_compliance;

-- Delete all compliance requirements except essential ones
DELETE FROM compliance_requirements 
WHERE requirement NOT IN (
    'Business License',
    'Health Certificate', 
    'Fire Safety Certificate',
    'Food Handler Certificates'
);

-- Verify remaining data
SELECT * FROM compliance_requirements;
SELECT COUNT(*) as total_compliance_records FROM branch_compliance;
