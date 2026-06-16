-- ============================================================
-- Migration 0006: Compatibility Verification Script
-- Run this AFTER all 0001-0005e migrations to confirm readiness.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABLE EXISTENCE CHECK
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_tbl TEXT;
  v_required TEXT[] := ARRAY[
    -- Core
    'users','staff_profiles','branches','roles','user_branch_roles',
    'departments','designations','notifications',
    -- Booking / Rooms
    'bookings','reservations','rooms','room_types','guests','folios',
    'folio_items','folio_payments','folio_transactions','unpaid_bills',
    'guest_documents','guest_preferences','guest_profiles',
    'guest_loyalty_transactions','booking_status_history','room_status_history',
    'rate_plans',
    -- Conference
    'conference_halls','conference_bookings','conference_hall_bookings',
    'conference_daily_attendance',
    -- Inventory
    'inventory_items','inventory_locations','inventory_balances',
    'inventory_batches','inventory_movements',
    -- Procurement
    'suppliers','purchase_orders','purchase_order_lines',
    'goods_receipts','goods_receipt_lines',
    'supplier_invoices','supplier_invoice_lines',
    'supplier_payments','supplier_ledger',
    'store_grni_control_account',
    -- Stock
    'branch_requisitions','branch_requisition_lines',
    'dispatches','dispatch_otps',
    'stock_takes','stock_take_lines',
    -- Fleet
    'vehicles','drivers','vehicle_assignments','dispatch_tracking',
    -- POS
    'pos_outlets','pos_shifts','pos_orders','pos_order_items',
    'cashier_shifts','cashier_transactions',
    -- Cashier extended
    'cashier_logbooks','cashier_logbook_lines','cashier_shift_logs',
    'float_history','petty_cash_transactions','petty_cash_ledger',
    -- Payments
    'branch_payments','branch_payment_audit','branch_payment_receipts',
    'payment_verifications','banking_transactions','banking_reconciliations',
    'bank_transactions',
    -- Restaurant
    'restaurant_menu_categories','restaurant_menu_items','restaurant_tables',
    'restaurant_table_assignments','restaurant_orders','restaurant_order_items',
    'restaurant_bills','restaurant_bill_audit_log','restaurant_bill_payments',
    'restaurant_inventory_items','restaurant_inventory_transactions',
    'restaurant_bar_inventory','restaurant_pool_token_sales',
    'restaurant_reservations',
    -- Bar
    'bar_drink_categories','bar_drinks','bar_stock','bar_stock_ledger',
    'bar_stock_records','bar_stock_requests','bar_stock_request_items',
    'bar_tabs','bar_tab_items','bar_orders','bar_order_items',
    -- Kitchen
    'kitchen_stock','kitchen_stock_ledger','kitchen_ledger_entries',
    'kitchen_usage_records','kitchen_usage_entries','kitchen_usage',
    'kitchen_portion_stock','kitchen_portion_ledger','kitchen_portion_tracking',
    'kitchen_requisitions','kitchen_requisition_items',
    'kitchen_grn','kitchen_grn_items','kitchen_store_receipts',
    'kitchen_store_receipt_items','kitchen_variance_logs','kitchen_variance_reasons',
    'kitchen_food_controls','kitchen_food_control_logs','kitchen_expected_portions',
    'kitchen_daily_variance','kitchen_wastage',
    'recipes','recipe_items','recipe_change_log','branch_food_control_config',
    'food_control_variance','central_spoilage_log',
    'buffets','buffet_menu_items',
    -- Catering
    'catering_events','catering_bookings','outside_catering_bookings',
    'catering_menu_items','catering_stock_allocations',
    -- Payroll / HR
    'payroll_policies','payroll_deduction_rates','payroll_runs','payroll_batches',
    'payroll_records','payroll','payroll_batches_lines','payroll_batch_lines',
    'staff_payroll','staff_payroll_adjustments','staff_payroll_items',
    'staff_advances','staff_loans','staff_loan_payments',
    'staff_credit_bills','staff_credit_bill_payments',
    'staff_monthly_statutory_deductions',
    'staff_attendance','staff_leave','staff_schedules','staff_performance',
    'staff_employment_history','staff_shifts','staff_documents',
    'employee_training','employee_time_clock','employee_tasks','employee_announcements',
    -- Maintenance
    'maintenance_assets','maintenance_asset_history','maintenance_contractors',
    'maintenance_requests','maintenance_work_orders','maintenance_work_order_tasks',
    'maintenance_work_order_attachments','maintenance_issues',
    'maintenance_spare_parts','maintenance_parts_transactions','maintenance_part_usage',
    'maintenance_preventive_schedules','maintenance_task_history',
    'maintenance_tools','maintenance_tasks','maintenance_meter_readings',
    -- Housekeeping extended
    'hk_tasks','hk_task_checklists','hk_inspections',
    'hk_linen_types','hk_linen_inventory','hk_linen_transactions',
    'hk_lost_found','hk_maintenance_requests','hk_guest_requests',
    'hk_guest_service_requests','hk_shift_definitions','hk_staff_schedules',
    'hk_leave_requests','hk_shift_swaps','hk_daily_metrics','hk_staff_daily_metrics',
    'hk_quality_alerts','hk_room_status_history','hk_supply_predictions',
    'hk_demand_forecasts','hk_staff_predictions','hk_achievements',
    'hk_staff_achievements','hk_staff_points','hk_team_challenges',
    'hk_sustainability_metrics','hk_sustainability_daily','hk_staff_locations',
    'hk_notifications','hk_booking_sync','hk_green_guests','hk_guest_preferences',
    -- System config
    'simple_app_config','system_config_values','system_config_history',
    'feature_flags','security_config','security_events','blocked_ips',
    -- Finance daily logs
    'finance_daily_logs','finance_daily_log_lines',
    'financial_daily_snapshots','financial_workspace_submissions',
    'revenue_targets','budgets','budget_adjustments','shift_financials',
    -- Audit / compliance
    'audit_exceptions','audit_findings','audit_night_sessions','audit_plans',
    'audit_config_consumption','auditor_reviews','auditor_watchlist',
    'void_bills','void_bills_audit','void_requests',
    'discrepancy_flags','rls_audit_log','attendance_audit_logs',
    -- Accounting
    'accounting_chart_of_accounts','accounting_journal_entries','accounting_journal_lines',
    'accounting_customers','accounting_vendors',
    'accounting_ar_invoices','accounting_ap_bills',
    'accounting_bank_transactions','accounting_budgets',
    -- LINA
    'lina_agent_logs','lina_remediation_events','lina_remediation_proposals',
    'lina_remediation_executions','lina_system_snapshots',
    -- Communication
    'announcements','communication_channels','channel_members',
    'channel_messages','message_reactions','guest_messages',
    -- Payment
    'payment_verifications',
    -- Director
    'director_review_tasks',
    -- Misc
    'automation_runs','kenyan_public_holidays','staff_usage_summary',
    -- OTP / sequences
    '_otps','_doc_sequences'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_required LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_tbl
    ) THEN
      v_missing := v_missing || v_tbl;
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE NOTICE 'MISSING TABLES (%): %', array_length(v_missing,1), array_to_string(v_missing,', ');
  ELSE
    RAISE NOTICE '✅ ALL REQUIRED TABLES EXIST';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. RPC FUNCTION EXISTENCE CHECK
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required TEXT[] := ARRAY[
    'generate_po_number','generate_reservation_number','generate_bill_number',
    'generate_cashier_transaction_number','generate_shift_number',
    'generate_payment_number','generate_invoice_number',
    'generate_transaction_number','generate_order_number','get_next_order_number',
    'generate_credit_number','get_next_dispatch_number',
    'get_next_stock_request_number','get_next_sku_serial','generate_barcode',
    'generate_kitchen_receipt_number','generate_kitchen_ledger_number',
    'generate_portion_tracking_number','get_stock_take_number',
    'get_central_stock_take_number','get_spoilage_number',
    'generate_service_booking_number','generate_dispatch_otp','generate_otp',
    'approve_grn_and_update_all','approve_supplier_invoice_and_update_ledger',
    'update_branch_stock','update_stock_level','decrement_bar_stock',
    'receive_purchase_order','submit_stock_take_with_lock',
    'calculate_bill_totals','calculate_shift_summary',
    'get_shift_reconciliation_totals','calculate_conference_invoice_with_attendance',
    'update_tab_total','min_stock_level','verify_dispatch_otp',
    'cleanup_expired_otps','create_audit_log','get_unread_count',
    'get_rls_policies','exec_sql','_next_seq'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_required LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = v_fn
    ) THEN
      v_missing := v_missing || v_fn;
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE NOTICE 'MISSING RPC FUNCTIONS (%): %', array_length(v_missing,1), array_to_string(v_missing,', ');
  ELSE
    RAISE NOTICE '✅ ALL REQUIRED RPC FUNCTIONS EXIST';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. CRITICAL COLUMNS CHECK
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role') THEN v_missing := v_missing || 'users.role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='rfid_tag') THEN v_missing := v_missing || 'users.rfid_tag'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='pos_pin') THEN v_missing := v_missing || 'users.pos_pin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='active_outlet_id') THEN v_missing := v_missing || 'users.active_outlet_id'; END IF;
  -- staff_profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_profiles' AND column_name='basic_salary') THEN v_missing := v_missing || 'staff_profiles.basic_salary'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_profiles' AND column_name='rfid_tag') THEN v_missing := v_missing || 'staff_profiles.rfid_tag'; END IF;
  -- bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='check_in_date') THEN v_missing := v_missing || 'bookings.check_in_date'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='deposit_amount') THEN v_missing := v_missing || 'bookings.deposit_amount'; END IF;
  -- guests
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='guests' AND column_name='is_vip') THEN v_missing := v_missing || 'guests.is_vip'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='guests' AND column_name='car_number_plate') THEN v_missing := v_missing || 'guests.car_number_plate'; END IF;
  -- rooms
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='type_id') THEN v_missing := v_missing || 'rooms.type_id'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='amenities') THEN v_missing := v_missing || 'rooms.amenities'; END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE NOTICE 'MISSING CRITICAL COLUMNS (%): %', array_length(v_missing,1), array_to_string(v_missing,', ');
  ELSE
    RAISE NOTICE '✅ ALL CRITICAL COLUMNS EXIST';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. VIEW EXISTENCE CHECK
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='vw_hk_daily_summary') THEN v_missing := v_missing || 'vw_hk_daily_summary'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='vw_hk_staff_workload') THEN v_missing := v_missing || 'vw_hk_staff_workload'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_central_spoilage_log') THEN v_missing := v_missing || 'v_central_spoilage_log'; END IF;
  -- compat views from 0003
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='store_purchase_orders') THEN v_missing := v_missing || 'store_purchase_orders'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='store_grn') THEN v_missing := v_missing || 'store_grn'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='branch_stock') THEN v_missing := v_missing || 'branch_stock (compat view)'; END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE NOTICE 'MISSING VIEWS (%): %', array_length(v_missing,1), array_to_string(v_missing,', ');
  ELSE
    RAISE NOTICE '✅ ALL REQUIRED VIEWS EXIST';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. COMPATIBILITY SCORE SUMMARY (table counts)
-- ─────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS total_tables_in_public_schema,
  (SELECT COUNT(*) FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_type = 'FUNCTION') AS total_functions,
  (SELECT COUNT(*) FROM information_schema.views
   WHERE table_schema = 'public') AS total_views
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

DO $$
BEGIN
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║          MIGRATION PACKAGE EXECUTION COMPLETE            ║
║                                                          ║
║  Run 0001 → 0005e then this script to verify.            ║
║  All RAISE NOTICE lines above should say OK              ║
║  If any say MISSING, re-run the relevant migration file. ║
╚══════════════════════════════════════════════════════════╝
';
END;
$$;
