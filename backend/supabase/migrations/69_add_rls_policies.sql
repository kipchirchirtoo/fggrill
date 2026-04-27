-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Migration: 69_add_rls_policies.sql
-- Created: April 27, 2026
-- Purpose: Implement database-level security with RLS
-- =====================================================

-- =====================================================
-- 1. ENABLE RLS ON CRITICAL TABLES
-- =====================================================

-- Purchase Orders
ALTER TABLE store_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_purchase_orders ENABLE ROW LEVEL SECURITY;

-- Financial Tables
ALTER TABLE accounting_ar_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_ap_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_bank_transactions ENABLE ROW LEVEL SECURITY;

-- Inventory
ALTER TABLE simple_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_suppliers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. PURCHASE ORDER RLS POLICIES
-- =====================================================

-- Policy: Users can only see POs from their module and branch
CREATE POLICY "po_module_branch_isolation" ON store_purchase_orders
FOR SELECT
USING (
    -- Super Admin and Auditor can see all
    (auth.jwt() ->> 'role' IN ('super_admin', 'auditor'))
    OR
    -- Central Storekeeper sees only central_store module
    (
        auth.jwt() ->> 'role' = 'central_storekeeper'
        AND source_module = 'central_store'
        AND branch_id IS NULL
    )
    OR
    -- Branch Storekeeper sees only their branch's branch_store POs
    (
        auth.jwt() ->> 'role' = 'branch_storekeeper'
        AND source_module = 'branch_store'
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
    OR
    -- Branch Accountant sees only their branch's branch_accounting POs
    (
        auth.jwt() ->> 'role' = 'branch_accountant'
        AND source_module = 'branch_accounting'
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
);

-- Policy: Users can only create POs in their authorized module
CREATE POLICY "po_create_module_restriction" ON store_purchase_orders
FOR INSERT
WITH CHECK (
    -- Super Admin can create in any module
    (auth.jwt() ->> 'role' = 'super_admin')
    OR
    -- Central Storekeeper can create only in central_store
    (
        auth.jwt() ->> 'role' = 'central_storekeeper'
        AND source_module = 'central_store'
        AND branch_id IS NULL
    )
    OR
    -- Branch Storekeeper can create only in their branch's branch_store
    (
        auth.jwt() ->> 'role' = 'branch_storekeeper'
        AND source_module = 'branch_store'
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
    OR
    -- Branch Accountant can create only in their branch's branch_accounting
    (
        auth.jwt() ->> 'role' = 'branch_accountant'
        AND source_module = 'branch_accounting'
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
);

-- Policy: Users can only update their own module's POs
CREATE POLICY "po_update_module_restriction" ON store_purchase_orders
FOR UPDATE
USING (
    -- Super Admin can update any
    (auth.jwt() ->> 'role' = 'super_admin')
    OR
    -- Central Storekeeper can update central_store POs
    (
        auth.jwt() ->> 'role' = 'central_storekeeper'
        AND source_module = 'central_store'
    )
    OR
    -- Branch Storekeeper can update their branch's branch_store POs
    (
        auth.jwt() ->> 'role' = 'branch_storekeeper'
        AND source_module = 'branch_store'
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
    OR
    -- Branch Accountant can update their branch's branch_accounting POs
    (
        auth.jwt() ->> 'role' = 'branch_accountant'
        AND source_module = 'branch_accounting'
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
);

-- Policy: Only authorized users can delete POs
CREATE POLICY "po_delete_restriction" ON store_purchase_orders
FOR DELETE
USING (
    -- Only Super Admin can delete
    (auth.jwt() ->> 'role' = 'super_admin')
    OR
    -- Managers can delete draft POs in their module
    (
        status = 'draft'
        AND (
            (auth.jwt() ->> 'role' = 'central_storekeeper' AND source_module = 'central_store')
            OR
            (auth.jwt() ->> 'role' = 'branch_storekeeper' AND source_module = 'branch_store' AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER)
        )
    )
);

-- =====================================================
-- 3. INVOICE RLS POLICIES
-- =====================================================

-- Policy: Branch-level users see only their branch's invoices
CREATE POLICY "invoice_branch_isolation" ON accounting_ar_invoices
FOR SELECT
USING (
    -- Super Admin and Auditor can see all
    (auth.jwt() ->> 'role' IN ('super_admin', 'auditor', 'accountant'))
    OR
    -- Branch users see only their branch
    (
        auth.jwt() ->> 'role' IN ('branch_accountant', 'cashier', 'receptionist')
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
);

-- Policy: Only authorized users can create invoices
CREATE POLICY "invoice_create_restriction" ON accounting_ar_invoices
FOR INSERT
WITH CHECK (
    auth.jwt() ->> 'role' IN ('super_admin', 'accountant', 'branch_accountant', 'cashier', 'receptionist')
    AND (
        -- Super Admin and Accountant can create for any branch
        auth.jwt() ->> 'role' IN ('super_admin', 'accountant')
        OR
        -- Branch users can only create for their branch
        branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
);

-- =====================================================
-- 4. PAYMENT RLS POLICIES
-- =====================================================

-- Policy: Branch-level users see only their branch's payments
CREATE POLICY "payment_branch_isolation" ON payments
FOR SELECT
USING (
    -- Super Admin and Auditor can see all
    (auth.jwt() ->> 'role' IN ('super_admin', 'auditor', 'accountant', 'finance_manager'))
    OR
    -- Branch users see only their branch
    (
        auth.jwt() ->> 'role' IN ('branch_accountant', 'cashier')
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
);

-- =====================================================
-- 5. INVENTORY RLS POLICIES
-- =====================================================

-- Policy: Branch storekeepers see only their branch's items
CREATE POLICY "items_branch_isolation" ON simple_items
FOR SELECT
USING (
    -- Super Admin and Central Storekeeper can see all
    (auth.jwt() ->> 'role' IN ('super_admin', 'central_storekeeper'))
    OR
    -- Branch Storekeeper sees only their branch's items
    (
        auth.jwt() ->> 'role' = 'branch_storekeeper'
        AND branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
    )
);

-- Policy: Suppliers are scoped by branch
CREATE POLICY "supplier_branch_isolation" ON store_suppliers
FOR SELECT
USING (
    -- Super Admin and Central Storekeeper can see all
    (auth.jwt() ->> 'role' IN ('super_admin', 'central_storekeeper'))
    OR
    -- Branch users see only their branch's suppliers + global suppliers
    (
        auth.jwt() ->> 'role' IN ('branch_storekeeper', 'branch_accountant')
        AND (
            branch_id = (auth.jwt() ->> 'branch_id')::INTEGER
            OR branch_id IS NULL  -- Global suppliers
        )
    )
);

-- =====================================================
-- 6. AUDIT LOGGING
-- =====================================================

-- Create audit log table for RLS policy violations
CREATE TABLE IF NOT EXISTS rls_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    user_role TEXT,
    table_name TEXT,
    operation TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    denied_reason TEXT,
    request_details JSONB
);

-- Function to log RLS violations
CREATE OR REPLACE FUNCTION log_rls_violation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO rls_audit_log (
        user_id,
        user_role,
        table_name,
        operation,
        denied_reason,
        request_details
    ) VALUES (
        (auth.jwt() ->> 'sub')::UUID,
        auth.jwt() ->> 'role',
        TG_TABLE_NAME,
        TG_OP,
        'RLS policy denied access',
        jsonb_build_object(
            'new', to_jsonb(NEW),
            'old', to_jsonb(OLD)
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Revoke all public access
REVOKE ALL ON store_purchase_orders FROM anon;
REVOKE ALL ON accounting_ar_invoices FROM anon;
REVOKE ALL ON payments FROM anon;

-- Grant authenticated users access (RLS will filter)
GRANT SELECT, INSERT, UPDATE, DELETE ON store_purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON accounting_ar_invoices TO authenticated;
GRANT SELECT, INSERT ON payments TO authenticated;
GRANT SELECT ON simple_items TO authenticated;
GRANT SELECT ON store_suppliers TO authenticated;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON POLICY "po_module_branch_isolation" ON store_purchase_orders IS 
'Enforces module and branch isolation for purchase orders at database level';

COMMENT ON POLICY "invoice_branch_isolation" ON accounting_ar_invoices IS 
'Ensures branch users can only see invoices from their branch';

COMMENT ON POLICY "payment_branch_isolation" ON payments IS 
'Restricts payment visibility to authorized users and branches';

-- =====================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- =====================================================

-- To rollback this migration:
-- DROP POLICY IF EXISTS "po_module_branch_isolation" ON store_purchase_orders;
-- DROP POLICY IF EXISTS "po_create_module_restriction" ON store_purchase_orders;
-- DROP POLICY IF EXISTS "po_update_module_restriction" ON store_purchase_orders;
-- DROP POLICY IF EXISTS "po_delete_restriction" ON store_purchase_orders;
-- DROP POLICY IF EXISTS "invoice_branch_isolation" ON accounting_ar_invoices;
-- DROP POLICY IF EXISTS "invoice_create_restriction" ON accounting_ar_invoices;
-- DROP POLICY IF EXISTS "payment_branch_isolation" ON payments;
-- DROP POLICY IF EXISTS "items_branch_isolation" ON simple_items;
-- DROP POLICY IF EXISTS "supplier_branch_isolation" ON store_suppliers;
-- ALTER TABLE store_purchase_orders DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE accounting_ar_invoices DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS rls_audit_log;
-- DROP FUNCTION IF EXISTS log_rls_violation();
