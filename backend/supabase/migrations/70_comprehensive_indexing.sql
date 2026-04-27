-- =====================================================
-- COMPREHENSIVE DATABASE INDEXING MIGRATION (SAFE VERSION)
-- =====================================================
-- Purpose: Optimize query performance across all high-traffic tables
-- Based on: FamousGates Hotel & Restaurant Management System schema analysis
-- Date: 2026-04-27
-- Note: Only indexes columns that definitely exist in the schema
-- =====================================================

-- =====================================================
-- 1. USERS & AUTHENTICATION
-- =====================================================

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login) WHERE last_login IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE department IS NOT NULL;

-- Staff profiles
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_department ON staff_profiles(department);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON staff_profiles(status);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_department_status ON staff_profiles(department, status);

-- =====================================================
-- 2. ROOMS & HOUSEKEEPING
-- =====================================================

-- Rooms
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor);
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_type_id ON rooms(type_id);

-- Partial index for available rooms only
CREATE INDEX IF NOT EXISTS idx_rooms_available ON rooms(id) 
WHERE status = 'available';

-- Room status history
CREATE INDEX IF NOT EXISTS idx_room_status_history_room_id ON room_status_history(room_id);
CREATE INDEX IF NOT EXISTS idx_room_status_history_created_at ON room_status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_room_status_history_changed_by ON room_status_history(changed_by);

-- =====================================================
-- 3. BOOKINGS & RESERVATIONS
-- =====================================================

-- Bookings
CREATE INDEX IF NOT EXISTS idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON bookings(check_in_date);
CREATE INDEX IF NOT EXISTS idx_bookings_check_out ON bookings(check_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_dates_status ON bookings(check_in_date, check_out_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings(room_id, check_in_date, check_out_date);

-- Partial index for active bookings
CREATE INDEX IF NOT EXISTS idx_bookings_active ON bookings(room_id, check_in_date, check_out_date) 
WHERE status IN ('confirmed', 'checked_in');

-- Booking status history
CREATE INDEX IF NOT EXISTS idx_booking_status_history_booking_id ON booking_status_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_status_history_created_at ON booking_status_history(created_at);

-- Booking payments
CREATE INDEX IF NOT EXISTS idx_booking_payments_booking_id ON booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_created_by ON booking_payments(created_by);
CREATE INDEX IF NOT EXISTS idx_booking_payments_payment_date ON booking_payments(payment_date);

-- =====================================================
-- 4. GUESTS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_guest_profiles_user_id ON guest_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_guest_profiles_id_number ON guest_profiles(id_number);
CREATE INDEX IF NOT EXISTS idx_guest_profiles_vip_status ON guest_profiles(vip_status) WHERE vip_status = true;

-- =====================================================
-- 5. RESTAURANT & POS
-- =====================================================

-- Menu categories
CREATE INDEX IF NOT EXISTS idx_menu_categories_is_active ON restaurant_menu_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort_order ON restaurant_menu_categories(sort_order);

-- Menu items
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON restaurant_menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON restaurant_menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_available ON restaurant_menu_items(category_id, is_available);

-- Restaurant orders - CRITICAL: Add idempotency key (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurant_orders' AND column_name = 'idempotency_key'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_orders_idempotency ON restaurant_orders(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status ON restaurant_orders(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_order_number ON restaurant_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_guest_id ON restaurant_orders(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_created_at ON restaurant_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_order_type ON restaurant_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_created_by ON restaurant_orders(created_by);

-- Partial index for open orders (kitchen display)
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_open ON restaurant_orders(created_at) 
WHERE status IN ('pending', 'confirmed', 'preparing');

-- Order items
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order_id ON restaurant_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_menu_item_id ON restaurant_order_items(menu_item_id);

-- Restaurant inventory
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_items_name ON restaurant_inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_items_current_stock ON restaurant_inventory_items(current_stock, minimum_stock);

-- Partial index for low stock
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_low_stock ON restaurant_inventory_items(id, current_stock) 
WHERE current_stock <= minimum_stock;

-- Inventory transactions
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_trans_item_id ON restaurant_inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_trans_created_at ON restaurant_inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_trans_created_by ON restaurant_inventory_transactions(created_by);

-- =====================================================
-- 6. PAYMENTS & FINANCE
-- =====================================================

-- Finance transactions - idempotency key (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'finance_transactions' AND column_name = 'idempotency_key'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_transactions_idempotency ON finance_transactions(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_type ON finance_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_status ON finance_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_created_at ON finance_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_created_by ON finance_transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_reference ON finance_transactions(reference_type, reference_id) 
WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- Finance invoices
CREATE INDEX IF NOT EXISTS idx_finance_invoices_invoice_number ON finance_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_guest_id ON finance_invoices(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_invoices_booking_id ON finance_invoices(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_due_date ON finance_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_created_at ON finance_invoices(created_at);

-- Finance invoice items
CREATE INDEX IF NOT EXISTS idx_finance_invoice_items_invoice_id ON finance_invoice_items(invoice_id);

-- Finance payments
CREATE INDEX IF NOT EXISTS idx_finance_payments_payment_number ON finance_payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_finance_payments_invoice_id ON finance_payments(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_payments_booking_id ON finance_payments(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_payments_status ON finance_payments(status);
CREATE INDEX IF NOT EXISTS idx_finance_payments_payment_method ON finance_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_finance_payments_created_at ON finance_payments(created_at);

-- =====================================================
-- 7. STOREKEEPING & INVENTORY
-- =====================================================

-- Store departments
CREATE INDEX IF NOT EXISTS idx_store_departments_code ON store_departments(code);
CREATE INDEX IF NOT EXISTS idx_store_departments_is_active ON store_departments(is_active);
CREATE INDEX IF NOT EXISTS idx_store_departments_manager_id ON store_departments(manager_id) WHERE manager_id IS NOT NULL;

-- Store locations
CREATE INDEX IF NOT EXISTS idx_store_locations_code ON store_locations(code);
CREATE INDEX IF NOT EXISTS idx_store_locations_is_active ON store_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_store_locations_type ON store_locations(type) WHERE type IS NOT NULL;

-- Store items
CREATE INDEX IF NOT EXISTS idx_store_items_item_code ON store_items(item_code);
CREATE INDEX IF NOT EXISTS idx_store_items_category ON store_items(category);
CREATE INDEX IF NOT EXISTS idx_store_items_barcode ON store_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_items_is_active ON store_items(is_active);
CREATE INDEX IF NOT EXISTS idx_store_items_storage_location ON store_items(storage_location_id) WHERE storage_location_id IS NOT NULL;

-- Partial index for low stock items
CREATE INDEX IF NOT EXISTS idx_store_items_low_stock ON store_items(current_stock, reorder_level) 
WHERE current_stock <= reorder_level AND is_active = true;

-- Store item batches
CREATE INDEX IF NOT EXISTS idx_store_item_batches_item_id ON store_item_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_store_item_batches_batch_number ON store_item_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_store_item_batches_expiry ON store_item_batches(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_item_batches_is_expired ON store_item_batches(is_expired) WHERE is_expired = true;

-- Store item suppliers
CREATE INDEX IF NOT EXISTS idx_store_item_suppliers_item_id ON store_item_suppliers(item_id);
CREATE INDEX IF NOT EXISTS idx_store_item_suppliers_supplier_id ON store_item_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_store_item_suppliers_is_preferred ON store_item_suppliers(is_preferred) WHERE is_preferred = true;

-- =====================================================
-- 8. STAFF MANAGEMENT
-- =====================================================

-- Staff schedules
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date ON staff_schedules(date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_shift ON staff_schedules(shift);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_date ON staff_schedules(staff_id, date);

-- Staff leave
CREATE INDEX IF NOT EXISTS idx_staff_leave_staff_id ON staff_leave(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_leave_status ON staff_leave(status);
CREATE INDEX IF NOT EXISTS idx_staff_leave_dates ON staff_leave(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_staff_leave_leave_type ON staff_leave(leave_type);

-- Staff payroll
CREATE INDEX IF NOT EXISTS idx_staff_payroll_staff_id ON staff_payroll(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_period ON staff_payroll(year, month);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_status ON staff_payroll(status);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_staff_period ON staff_payroll(staff_id, year, month);

-- Staff performance
CREATE INDEX IF NOT EXISTS idx_staff_performance_staff_id ON staff_performance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_performance_period ON staff_performance(review_period_year, review_period_month);
CREATE INDEX IF NOT EXISTS idx_staff_performance_reviewer_id ON staff_performance(reviewer_id);

-- =====================================================
-- 9. MAINTENANCE
-- =====================================================

-- Maintenance requests (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'maintenance_requests'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
    CREATE INDEX IF NOT EXISTS idx_maintenance_requests_priority ON maintenance_requests(priority);
    CREATE INDEX IF NOT EXISTS idx_maintenance_requests_created_at ON maintenance_requests(created_at);
  END IF;
END $$;

-- =====================================================
-- 10. HOUSEKEEPING (Extended)
-- =====================================================

-- Housekeeping tasks (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'housekeeping_tasks'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_room_id ON housekeeping_tasks(room_id);
    CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_status ON housekeeping_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_assigned_to ON housekeeping_tasks(assigned_to);
  END IF;
END $$;

-- =====================================================
-- 11. BRANCH-SCOPED TABLES (Only if branch_id exists)
-- =====================================================

-- These indexes will only be created if the branch_id column exists in the respective tables

-- Branches table
CREATE INDEX IF NOT EXISTS idx_branches_name ON branches(name);

-- Bookings with branch_id (added in multi-branch migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'branch_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON bookings(branch_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_branch_status ON bookings(branch_id, status);
  END IF;
END $$;

-- Restaurant orders with branch_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurant_orders' AND column_name = 'branch_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch_id ON restaurant_orders(branch_id);
    CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch_status ON restaurant_orders(branch_id, status);
    CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch_date ON restaurant_orders(branch_id, created_at);
  END IF;
END $$;

-- Finance transactions with branch_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'finance_transactions' AND column_name = 'branch_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_finance_transactions_branch_id ON finance_transactions(branch_id);
  END IF;
END $$;

-- Rooms with branch_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' AND column_name = 'branch_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_rooms_branch_id ON rooms(branch_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_branch_status ON rooms(branch_id, status);
  END IF;
END $$;

-- =====================================================
-- 12. PAYMENTS TABLE (3-tier verification)
-- =====================================================

-- Payments table (if exists - from migration 39)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    -- CRITICAL: Idempotency key (only if column exists)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'idempotency_key'
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key) 
      WHERE idempotency_key IS NOT NULL;
    END IF;
    
    -- Only create branch_id indexes if column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'branch_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON payments(branch_id);
      CREATE INDEX IF NOT EXISTS idx_payments_branch_status ON payments(branch_id, status);
      CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(branch_id, created_at) 
      WHERE status = 'pending';
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'recorded_by'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference_number'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_reference_number ON payments(reference_number) WHERE reference_number IS NOT NULL;
    END IF;
    
    -- Verification workflow indexes (only if columns exist)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'accountant_verified_by'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_accountant_verified ON payments(accountant_verified_by, accountant_verified_at) 
      WHERE accountant_verified_by IS NOT NULL;
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'auditor_verified_by'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_auditor_verified ON payments(auditor_verified_by, auditor_verified_at) 
      WHERE auditor_verified_by IS NOT NULL;
    END IF;
    
    -- Indexes for common foreign keys
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'booking_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id) WHERE booking_id IS NOT NULL;
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'invoice_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id) WHERE invoice_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- =====================================================
-- 13. AUDIT LOGS & SECURITY
-- =====================================================

-- Audit logs - BRIN index for time-series data (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'audit_logs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_brin ON audit_logs USING BRIN(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    
    -- Composite index for security monitoring
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_time ON audit_logs(user_id, action, created_at) 
    WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- RLS audit log (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'rls_audit_log'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_rls_audit_log_user_id ON rls_audit_log(user_id) WHERE user_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_rls_audit_log_created_at ON rls_audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_rls_audit_log_table_name ON rls_audit_log(table_name);
  END IF;
END $$;

-- =====================================================
-- 14. MAINTENANCE AUTOMATION
-- =====================================================

-- Create function to analyze tables (safe to run in function)
CREATE OR REPLACE FUNCTION analyze_all_tables()
RETURNS void AS $$
BEGIN
  -- Analyze all tables to update statistics
  ANALYZE;
  
  RAISE NOTICE 'Database analysis completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Manual maintenance commands (run these directly, not in a function):
-- REINDEX DATABASE CONCURRENTLY;
-- VACUUM ANALYZE;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Query to check index usage statistics
COMMENT ON FUNCTION analyze_all_tables() IS 
'Run weekly to update table statistics. Check index usage with:
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = ''public''
ORDER BY idx_scan DESC;

For full maintenance, run these commands directly:
REINDEX DATABASE CONCURRENTLY;
VACUUM ANALYZE;';

-- =====================================================
-- COMPLETION
-- =====================================================

-- Analyze all tables to update statistics
ANALYZE;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
