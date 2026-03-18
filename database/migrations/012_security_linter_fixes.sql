-- =============================================================================
-- Migration 012: Fix Supabase Security Linter Errors
-- =============================================================================
-- Fixes three categories of issues:
--   1. SECURITY DEFINER views (lint 0010) - recreate views without SECURITY DEFINER
--   2. RLS disabled on public tables (lint 0013) - enable RLS + permissive policies
--   3. RLS policies referencing user_metadata (lint 0015) - replace with safe role check
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1: Fix SECURITY DEFINER views
-- Recreate each view with SECURITY INVOKER (the default) so RLS of the
-- querying user is respected, not the view creator's.
-- -----------------------------------------------------------------------------

-- We can't ALTER a view's security property directly in older Postgres versions,
-- so we drop and recreate. The view definitions are preserved as-is; only the
-- SECURITY DEFINER property is removed.

DO $$
DECLARE
  v_views TEXT[] := ARRAY[
    'vw_hk_daily_summary',
    'v_low_stock_by_branch',
    'vw_hk_sustainability_summary',
    'guest_stay_history',
    'v_staff_accountability',
    'v_dispatch_summary',
    'restaurant_table_occupancy',
    'restaurant_item_popularity',
    'v_in_transit_summary',
    'v_consumption_summary',
    'restaurant_daily_revenue',
    'v_inventory_alerts',
    'v_transfer_status',
    'v_stock_count_variances',
    'v_daily_kitchen_usage',
    'v_low_stock_alerts',
    'v_expiring_items'
  ];
  v_name TEXT;
  v_def TEXT;
BEGIN
  FOREACH v_name IN ARRAY v_views LOOP
    -- Get the current view definition
    SELECT pg_get_viewdef(('public.' || v_name)::regclass, true)
    INTO v_def;

    IF v_def IS NOT NULL THEN
      -- Drop and recreate without SECURITY DEFINER (default is SECURITY INVOKER)
      EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(v_name) || ' CASCADE';
      EXECUTE 'CREATE OR REPLACE VIEW public.' || quote_ident(v_name) || ' AS ' || v_def;
      -- Restore default privileges
      EXECUTE 'GRANT SELECT ON public.' || quote_ident(v_name) || ' TO authenticated';
      EXECUTE 'GRANT SELECT ON public.' || quote_ident(v_name) || ' TO service_role';
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- PART 2: Enable RLS on all public tables missing it
-- Using a permissive "authenticated users can do everything" baseline policy.
-- Tighten these per-table as needed for your access model.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'compliance_requirements', 'budget_categories', 'forecasts', 'forecast_models',
    'procurement_requests', 'procurement_vendors', 'analytics_reports', 'analytics_metrics',
    'shift_templates', 'executive_snapshots', 'kpi_definitions', 'user_branch_access',
    'employee_announcements', 'catering_bookings', 'payroll_deduction_rates',
    'employee_time_clock', 'employee_documents', 'hotel_amenities', 'supplier_products',
    'employee_tasks', 'employee_training', 'kitchen_grn', 'sales_points',
    'dynamic_services', 'petty_cash_ledger', 'guest_loyalty', 'guest_requests',
    'guest_messages', 'guest_feedback', 'pool_tokens_inventory', 'shift_staff_assignments',
    'shift_transactions', 'shift_transaction_items', 'shift_audit_log',
    'guest_loyalty_transactions', 'pos_transactions', 'inter_branch_transfers',
    'booking_history', 'guest_documents', 'room_blocks', 'staff_payroll_adjustments',
    'group_bookings', 'reservation_guests', 'housekeeping_logs',
    'accounting_account_categories', 'staff_monthly_statutory_deductions',
    'sales_payment_reconciliation', 'kitchen_portion_stock', 'stock_count_items',
    'stock_valuation_methods', 'documents', 'kitchen_food_controls', 'procurement_orders',
    'kitchen_audit_logs', 'store_supplier_payments', 'store_supplier_invoice_items',
    'store_grni_control_account', 'store_payment_invoice_allocations', 'store_vat_transactions',
    'store_supplier_balances', 'store_supplier_invoices', 'pos_transaction_items',
    'stock_take_audit_log', 'payment_verifications', 'kitchen_grn_items',
    'kitchen_store_issue_items', 'branch_settings', 'reservations', 'kitchen_variances',
    'kitchen_wastage', 'kitchen_usage', 'payment_callbacks', 'kitchen_portion_ledger',
    'quotation_items', 'kitchen_stock', 'kitchen_stock_ledger', 'vendor_performance',
    'kitchen_requisitions', 'kitchen_requisition_items', 'delivery_schedules',
    'store_supplier_vat_summary', 'kitchen_daily_variance', 'kitchen_variance_reasons',
    'auditor_watchlist', 'email_logs', 'guests', 'maintenance_issues', 'variance_reasons',
    'variance_thresholds', 'transactions', 'accounting_journal_lines',
    'customer_invoice_payments', 'kitchen_store_issues', 'cash_drawer_logs',
    'variance_alerts', 'recipes', 'recipe_items', 'store_supplier_ledger',
    'store_vat_control_summary', '_migrations', 'kenyan_public_holidays',
    'attendance_audit_logs', 'hk_schedules', 'branches_backup', 'rate_plans',
    'branch_features', 'approval_requests', 'employee_credit_bills',
    'employee_credit_payments', 'customer_invoices', 'accounting_ap_bills',
    'accounting_bank_accounts', 'stock_valuation_layers', 'staff_loan_payments',
    'maintenance_parts_transactions', 'bank_accounts', 'bank_deposits',
    'maintenance_contractors', 'maintenance_meter_readings',
    'maintenance_work_order_attachments', 'transfer_batches', 'schema_migrations',
    'payment_receipts', 'audit_plans', 'audit_findings', 'store_supplier_credit_notes',
    'accounting_budgets', 'accounting_fiscal_periods', 'sku_registry', 'receipts',
    'receipt_items', 'shift_types', 'expense_categories', 'accounting_ar_invoices',
    'accounting_periods', 'tax_summaries', 'customer_invoice_items', 'quotations',
    'financial_audit_logs', 'accounting_bank_transactions', 'maintenance_tasks',
    'financial_reports', 'revenue_entries', 'branch_messages', 'branch_notifications',
    'branch_announcements', 'maintenance_tools', 'maintenance_part_usage',
    'maintenance_task_history', 'maintenance_asset_history', 'central_warehouse_inventory',
    'stock_levels', 'warehouse_requests', 'warehouse_dispatches', 'branch_transfers',
    'branch_performance_metrics', 'branch_compliance', 'store_credit_note_items',
    'revenue_sources', 'staff_shifts', 'folios', 'guest_saved_preferences',
    'amenity_bookings', 'stock_counts', 'void_bills_audit', 'kitchen_expected_portions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only act if the table exists in public schema
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Enable RLS
      EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY';

      -- Drop existing catch-all policy if present to avoid duplicates
      EXECUTE 'DROP POLICY IF EXISTS "authenticated_full_access" ON public.' || quote_ident(t);

      -- Create a permissive baseline: authenticated users have full access.
      -- Refine per table as your access model requires.
      EXECUTE '
        CREATE POLICY "authenticated_full_access"
        ON public.' || quote_ident(t) || '
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true)
      ';

      -- service_role bypasses RLS by default, but be explicit for clarity
      EXECUTE 'DROP POLICY IF EXISTS "service_role_full_access" ON public.' || quote_ident(t);
      EXECUTE '
        CREATE POLICY "service_role_full_access"
        ON public.' || quote_ident(t) || '
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
      ';
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- PART 3: Fix RLS policies on public.users that reference user_metadata
-- user_metadata is user-editable and must never be used in security policies.
-- Replace with a lookup against the users table itself (role column).
-- -----------------------------------------------------------------------------

-- Drop the insecure policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.users;

-- Recreate using a subquery on the users table role column instead of user_metadata.
-- This assumes public.users has a `role` column and `id` = auth.uid().

CREATE POLICY "Admins can view all profiles"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    -- User can always see their own row
    id = auth.uid()
    OR
    -- Or they are an admin (role stored in the DB, not user_metadata)
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'superadmin', 'super_admin')
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only admins can insert new user rows
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON public.users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

-- -----------------------------------------------------------------------------
-- PART 4: Sensitive columns - ensure RLS is enabled on the two flagged tables
-- (accounting_bank_accounts and bank_accounts are already covered in Part 2,
--  but we add explicit column-level notes here for awareness)
-- -----------------------------------------------------------------------------

-- accounting_bank_accounts.account_number and bank_accounts.account_number
-- are sensitive. RLS is now enabled via Part 2. If you want to restrict
-- the account_number column further, consider a column-level security policy
-- or masking function. Example (uncomment and adapt):
--
-- CREATE POLICY "hide_account_number_from_non_finance"
--   ON public.bank_accounts FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.users u
--       WHERE u.id = auth.uid()
--         AND u.role IN ('admin', 'superadmin', 'accountant', 'finance')
--     )
--   );
