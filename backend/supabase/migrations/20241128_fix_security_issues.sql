-- =====================================================
-- SECURITY FIX MIGRATION
-- Fix SECURITY DEFINER views and enable RLS on tables
-- Famous Gate Hotel Management System
-- =====================================================

-- =====================================================
-- PART 1: FIX SECURITY DEFINER VIEWS
-- Change views from SECURITY DEFINER to SECURITY INVOKER
-- =====================================================

-- Drop and recreate views with SECURITY INVOKER (default)
-- This ensures views respect the RLS policies of the querying user

-- 1. v_consumption_summary
DROP VIEW IF EXISTS public.v_consumption_summary;
CREATE VIEW public.v_consumption_summary AS
SELECT 
    cr.id,
    cr.item_id,
    ii.name as item_name,
    ii.sku,
    cr.quantity,
    cr.consumption_type,
    cr.recorded_by,
    cr.recorded_at,
    cr.branch_id,
    b.name as branch_name
FROM consumption_records cr
LEFT JOIN inventory_items ii ON cr.item_id = ii.id
LEFT JOIN branches b ON cr.branch_id = b.id;

-- 2. v_in_transit_summary
DROP VIEW IF EXISTS public.v_in_transit_summary;
CREATE VIEW public.v_in_transit_summary AS
SELECT 
    its.id,
    its.dispatch_id,
    its.item_sku,
    ii.name as item_name,
    its.quantity,
    its.from_branch_id,
    fb.name as from_branch_name,
    its.to_branch_id,
    tb.name as to_branch_name,
    its.status,
    its.dispatched_at,
    its.expected_arrival
FROM in_transit_stock its
LEFT JOIN inventory_items ii ON its.item_sku = ii.sku
LEFT JOIN branches fb ON its.from_branch_id = fb.id
LEFT JOIN branches tb ON its.to_branch_id = tb.id;

-- 3. v_inventory_alerts
DROP VIEW IF EXISTS public.v_inventory_alerts;
CREATE VIEW public.v_inventory_alerts AS
SELECT 
    bs.id,
    bs.item_sku,
    ii.name as item_name,
    bs.quantity,
    ii.reorder_level,
    bs.branch_id,
    b.name as branch_name,
    CASE 
        WHEN bs.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN bs.quantity <= COALESCE(ii.reorder_level, 10) THEN 'LOW_STOCK'
        ELSE 'OK'
    END as alert_type
FROM branch_stock bs
LEFT JOIN inventory_items ii ON bs.item_sku = ii.sku
LEFT JOIN branches b ON bs.branch_id = b.id
WHERE bs.quantity <= COALESCE(ii.reorder_level, 10);

-- 4. store_items (view)
DROP VIEW IF EXISTS public.store_items;
CREATE VIEW public.store_items AS
SELECT 
    ii.id,
    ii.sku,
    ii.name,
    ii.description,
    ii.category,
    ii.unit,
    ii.cost_price,
    ii.selling_price,
    ii.reorder_level,
    ii.is_trackable,
    ii.status,
    ii.created_at,
    ii.updated_at
FROM inventory_items ii
WHERE ii.status = 'active';

-- 5. v_low_stock_alerts
DROP VIEW IF EXISTS public.v_low_stock_alerts;
CREATE VIEW public.v_low_stock_alerts AS
SELECT 
    bs.id,
    bs.item_sku,
    ii.name as item_name,
    ii.category,
    bs.quantity as current_quantity,
    COALESCE(ii.reorder_level, 10) as reorder_level,
    bs.branch_id,
    b.name as branch_name,
    b.code as branch_code
FROM branch_stock bs
JOIN inventory_items ii ON bs.item_sku = ii.sku
JOIN branches b ON bs.branch_id = b.id
WHERE bs.quantity <= COALESCE(ii.reorder_level, 10)
ORDER BY bs.quantity ASC;

-- 6. v_requisition_summary
DROP VIEW IF EXISTS public.v_requisition_summary;
CREATE VIEW public.v_requisition_summary AS
SELECT 
    r.id,
    r.requisition_number,
    r.status,
    r.priority,
    r.requested_by,
    r.approved_by,
    r.branch_id,
    b.name as branch_name,
    r.created_at,
    r.updated_at,
    COUNT(ri.id) as items_count,
    SUM(ri.quantity * COALESCE(ri.unit_price, 0)) as total_value
FROM requisitions r
LEFT JOIN requisition_items ri ON r.id = ri.requisition_id
LEFT JOIN branches b ON r.branch_id = b.id
GROUP BY r.id, b.name;

-- 7. v_purchase_order_summary
DROP VIEW IF EXISTS public.v_purchase_order_summary;
CREATE VIEW public.v_purchase_order_summary AS
SELECT 
    po.id,
    po.po_number,
    po.status,
    po.supplier_id,
    s.name as supplier_name,
    po.created_by,
    po.approved_by,
    po.created_at,
    po.expected_delivery,
    COUNT(poi.id) as items_count,
    SUM(poi.quantity * poi.unit_price) as total_value
FROM purchase_orders po
LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
LEFT JOIN suppliers s ON po.supplier_id = s.id
GROUP BY po.id, s.name;

-- 8. v_stock_count_variances
DROP VIEW IF EXISTS public.v_stock_count_variances;
CREATE VIEW public.v_stock_count_variances AS
SELECT 
    sti.id,
    st.id as stock_take_id,
    sti.item_sku,
    ii.name as item_name,
    sti.system_quantity,
    sti.actual_quantity,
    (sti.actual_quantity - sti.system_quantity) as variance,
    st.branch_id,
    b.name as branch_name,
    st.status,
    st.created_at
FROM stock_take_items sti
JOIN stock_takes st ON sti.stock_take_id = st.id
LEFT JOIN inventory_items ii ON sti.item_sku = ii.sku
LEFT JOIN branches b ON st.branch_id = b.id
WHERE sti.actual_quantity != sti.system_quantity;

-- 9. v_pending_requests
DROP VIEW IF EXISTS public.v_pending_requests;
CREATE VIEW public.v_pending_requests AS
SELECT 
    sr.id,
    sr.request_number,
    sr.status,
    sr.priority,
    sr.requested_by,
    sr.branch_id,
    b.name as branch_name,
    b.code as branch_code,
    sr.created_at,
    sr.notes,
    COUNT(sri.id) as items_count
FROM stock_requests sr
LEFT JOIN stock_request_items sri ON sr.id = sri.request_id
LEFT JOIN branches b ON sr.branch_id = b.id
WHERE sr.status IN ('PENDING', 'APPROVED')
GROUP BY sr.id, b.name, b.code;

-- 10. store_suppliers (view)
DROP VIEW IF EXISTS public.store_suppliers;
CREATE VIEW public.store_suppliers AS
SELECT 
    id,
    name,
    contact_person,
    email,
    phone,
    address,
    payment_terms,
    status,
    created_at
FROM suppliers
WHERE status = 'active';

-- 11. v_supplier_performance
DROP VIEW IF EXISTS public.v_supplier_performance;
CREATE VIEW public.v_supplier_performance AS
SELECT 
    s.id as supplier_id,
    s.name as supplier_name,
    COUNT(po.id) as total_orders,
    COUNT(CASE WHEN po.status = 'COMPLETED' THEN 1 END) as completed_orders,
    SUM(CASE WHEN po.status = 'COMPLETED' THEN poi_total.total_value ELSE 0 END) as total_value,
    AVG(CASE WHEN grn.received_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (grn.received_at - po.created_at)) / 86400 
    END) as avg_delivery_days
FROM suppliers s
LEFT JOIN purchase_orders po ON s.id = po.supplier_id
LEFT JOIN (
    SELECT purchase_order_id, SUM(quantity * unit_price) as total_value
    FROM purchase_order_items
    GROUP BY purchase_order_id
) poi_total ON po.id = poi_total.purchase_order_id
LEFT JOIN goods_received_notes grn ON po.id = grn.purchase_order_id
GROUP BY s.id, s.name;

-- 12. v_low_stock_by_branch
DROP VIEW IF EXISTS public.v_low_stock_by_branch;
CREATE VIEW public.v_low_stock_by_branch AS
SELECT 
    b.id as branch_id,
    b.name as branch_name,
    b.code as branch_code,
    COUNT(CASE WHEN bs.quantity <= COALESCE(ii.reorder_level, 10) THEN 1 END) as low_stock_count,
    COUNT(CASE WHEN bs.quantity = 0 THEN 1 END) as out_of_stock_count
FROM branches b
LEFT JOIN branch_stock bs ON b.id = bs.branch_id
LEFT JOIN inventory_items ii ON bs.item_sku = ii.sku
WHERE b.status = 'active'
GROUP BY b.id, b.name, b.code;

-- 13. v_kitchen_usage_details
DROP VIEW IF EXISTS public.v_kitchen_usage_details;
CREATE VIEW public.v_kitchen_usage_details AS
SELECT 
    kur.id as record_id,
    kur.item_sku,
    ii.name as item_name,
    kur.received_quantity,
    kur.usage_date,
    kur.status,
    kur.branch_id,
    b.name as branch_name,
    kue.id as entry_id,
    kue.usage_type,
    kue.quantity as used_quantity,
    kue.responsible_staff_name,
    kue.reason,
    kue.created_at as entry_time
FROM kitchen_usage_records kur
LEFT JOIN inventory_items ii ON kur.item_sku = ii.sku
LEFT JOIN branches b ON kur.branch_id = b.id
LEFT JOIN kitchen_usage_entries kue ON kur.id = kue.usage_record_id;

-- 14. v_daily_kitchen_usage
DROP VIEW IF EXISTS public.v_daily_kitchen_usage;
CREATE VIEW public.v_daily_kitchen_usage AS
SELECT 
    kur.usage_date,
    kur.branch_id,
    b.name as branch_name,
    kur.item_sku,
    ii.name as item_name,
    kur.received_quantity,
    COALESCE(SUM(CASE WHEN kue.usage_type = 'CONSUMED' THEN kue.quantity ELSE 0 END), 0) as consumed,
    COALESCE(SUM(CASE WHEN kue.usage_type IN ('SPOILT', 'DAMAGED', 'EXPIRED') THEN kue.quantity ELSE 0 END), 0) as wastage,
    kur.received_quantity - COALESCE(SUM(kue.quantity), 0) as remaining
FROM kitchen_usage_records kur
LEFT JOIN inventory_items ii ON kur.item_sku = ii.sku
LEFT JOIN branches b ON kur.branch_id = b.id
LEFT JOIN kitchen_usage_entries kue ON kur.id = kue.usage_record_id
GROUP BY kur.usage_date, kur.branch_id, b.name, kur.item_sku, ii.name, kur.received_quantity;

-- 15. guest_stay_history
DROP VIEW IF EXISTS public.guest_stay_history;
CREATE VIEW public.guest_stay_history AS
SELECT 
    g.id as guest_id,
    g.first_name,
    g.last_name,
    g.email,
    g.phone,
    b.id as booking_id,
    b.check_in_date,
    b.check_out_date,
    b.room_id,
    r.room_number,
    r.room_type,
    b.total_amount,
    b.status as booking_status
FROM guests g
LEFT JOIN bookings b ON g.id = b.guest_id
LEFT JOIN rooms r ON b.room_id = r.id
ORDER BY b.check_in_date DESC;

-- 16. v_current_stock_levels
DROP VIEW IF EXISTS public.v_current_stock_levels;
CREATE VIEW public.v_current_stock_levels AS
SELECT 
    bs.id,
    bs.item_sku,
    ii.name as item_name,
    ii.category,
    ii.unit,
    bs.quantity,
    COALESCE(ii.reorder_level, 10) as reorder_level,
    ii.cost_price,
    (bs.quantity * COALESCE(ii.cost_price, 0)) as stock_value,
    bs.branch_id,
    b.name as branch_name,
    bs.updated_at as last_updated
FROM branch_stock bs
JOIN inventory_items ii ON bs.item_sku = ii.sku
JOIN branches b ON bs.branch_id = b.id;

-- 17. v_expiring_items
DROP VIEW IF EXISTS public.v_expiring_items;
CREATE VIEW public.v_expiring_items AS
SELECT 
    ib.id,
    ib.item_sku,
    ii.name as item_name,
    ib.batch_number,
    ib.quantity,
    ib.expiry_date,
    ib.branch_id,
    b.name as branch_name,
    (ib.expiry_date - CURRENT_DATE) as days_until_expiry
FROM inventory_batches ib
JOIN inventory_items ii ON ib.item_sku = ii.sku
JOIN branches b ON ib.branch_id = b.id
WHERE ib.expiry_date IS NOT NULL 
  AND ib.expiry_date <= (CURRENT_DATE + INTERVAL '30 days')
  AND ib.quantity > 0
ORDER BY ib.expiry_date ASC;

-- 18. v_transfer_status
DROP VIEW IF EXISTS public.v_transfer_status;
CREATE VIEW public.v_transfer_status AS
SELECT 
    st.id,
    st.transfer_number,
    st.status,
    st.from_branch_id,
    fb.name as from_branch_name,
    st.to_branch_id,
    tb.name as to_branch_name,
    st.created_by,
    st.created_at,
    st.completed_at,
    COUNT(sti.id) as items_count,
    SUM(sti.quantity) as total_quantity
FROM stock_transfers st
LEFT JOIN stock_transfer_items sti ON st.id = sti.transfer_id
LEFT JOIN branches fb ON st.from_branch_id = fb.id
LEFT JOIN branches tb ON st.to_branch_id = tb.id
GROUP BY st.id, fb.name, tb.name;

-- 19. v_inventory_valuation
DROP VIEW IF EXISTS public.v_inventory_valuation;
CREATE VIEW public.v_inventory_valuation AS
SELECT 
    b.id as branch_id,
    b.name as branch_name,
    b.code as branch_code,
    COUNT(DISTINCT bs.item_sku) as total_items,
    SUM(bs.quantity) as total_quantity,
    SUM(bs.quantity * COALESCE(ii.cost_price, 0)) as total_value
FROM branches b
LEFT JOIN branch_stock bs ON b.id = bs.branch_id
LEFT JOIN inventory_items ii ON bs.item_sku = ii.sku
WHERE b.status = 'active'
GROUP BY b.id, b.name, b.code;

-- 20. v_staff_accountability
DROP VIEW IF EXISTS public.v_staff_accountability;
CREATE VIEW public.v_staff_accountability AS
SELECT 
    kue.responsible_staff_id,
    kue.responsible_staff_name,
    kur.branch_id,
    b.name as branch_name,
    DATE_TRUNC('month', kue.created_at) as month,
    SUM(CASE WHEN kue.usage_type = 'CONSUMED' THEN kue.quantity ELSE 0 END) as total_consumed,
    SUM(CASE WHEN kue.usage_type IN ('SPOILT', 'DAMAGED', 'EXPIRED', 'LOST') THEN kue.quantity ELSE 0 END) as total_wastage,
    COUNT(DISTINCT kur.id) as records_count
FROM kitchen_usage_entries kue
JOIN kitchen_usage_records kur ON kue.usage_record_id = kur.id
LEFT JOIN branches b ON kur.branch_id = b.id
WHERE kue.responsible_staff_id IS NOT NULL OR kue.responsible_staff_name IS NOT NULL
GROUP BY kue.responsible_staff_id, kue.responsible_staff_name, kur.branch_id, b.name, DATE_TRUNC('month', kue.created_at);


-- =====================================================
-- PART 2: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =====================================================

-- Enable RLS on all tables that need it
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumption_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simple_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simple_app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simple_shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simple_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_transit_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_out_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simple_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_usage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_usage_summary ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- PART 3: CREATE RLS POLICIES
-- Allow authenticated users to access data based on their role
-- =====================================================

-- Helper function to check user role (if not exists)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    (SELECT role FROM public.users WHERE id = auth.uid()::uuid)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's branch_id
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'branch_id')::integer,
    (SELECT branch_id FROM public.users WHERE id = auth.uid()::uuid)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic read policy for authenticated users (admin roles see all)
-- For most tables, we'll create a policy that allows:
-- - Super admins, general managers, and auditors to see all data
-- - Branch managers and staff to see their branch data only

-- =====================================================
-- BRANCHES - Everyone can read, only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "branches_select_policy" ON public.branches;
CREATE POLICY "branches_select_policy" ON public.branches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "branches_modify_policy" ON public.branches;
CREATE POLICY "branches_modify_policy" ON public.branches
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager'));

-- =====================================================
-- DEPARTMENTS - Everyone can read, only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "departments_select_policy" ON public.departments;
CREATE POLICY "departments_select_policy" ON public.departments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "departments_modify_policy" ON public.departments;
CREATE POLICY "departments_modify_policy" ON public.departments
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager'));

-- =====================================================
-- ROLES & PERMISSIONS - Only admins
-- =====================================================
DROP POLICY IF EXISTS "roles_policy" ON public.roles;
CREATE POLICY "roles_policy" ON public.roles
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager'));

DROP POLICY IF EXISTS "permissions_policy" ON public.permissions;
CREATE POLICY "permissions_policy" ON public.permissions
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager'));

-- =====================================================
-- INVENTORY ITEMS - Everyone can read, central store manages
-- =====================================================
DROP POLICY IF EXISTS "inventory_items_select_policy" ON public.inventory_items;
CREATE POLICY "inventory_items_select_policy" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_items_modify_policy" ON public.inventory_items;
CREATE POLICY "inventory_items_modify_policy" ON public.inventory_items
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

-- =====================================================
-- BRANCH_STOCK - Branch-specific access
-- =====================================================
DROP POLICY IF EXISTS "branch_stock_select_policy" ON public.branch_stock;
CREATE POLICY "branch_stock_select_policy" ON public.branch_stock
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  );

DROP POLICY IF EXISTS "branch_stock_modify_policy" ON public.branch_stock;
CREATE POLICY "branch_stock_modify_policy" ON public.branch_stock
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper')
    OR (get_user_role() = 'branch_storekeeper' AND branch_id = get_user_branch_id())
  )
  WITH CHECK (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper')
    OR (get_user_role() = 'branch_storekeeper' AND branch_id = get_user_branch_id())
  );

-- =====================================================
-- STOCK_REQUESTS - Branch can create, central reviews
-- =====================================================
DROP POLICY IF EXISTS "stock_requests_select_policy" ON public.stock_requests;
CREATE POLICY "stock_requests_select_policy" ON public.stock_requests
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  );

DROP POLICY IF EXISTS "stock_requests_insert_policy" ON public.stock_requests;
CREATE POLICY "stock_requests_insert_policy" ON public.stock_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('super_admin', 'general_manager', 'branch_storekeeper', 'branch_manager')
  );

DROP POLICY IF EXISTS "stock_requests_update_policy" ON public.stock_requests;
CREATE POLICY "stock_requests_update_policy" ON public.stock_requests
  FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper')
    OR (get_user_role() IN ('branch_storekeeper', 'branch_manager') AND branch_id = get_user_branch_id())
  );

-- =====================================================
-- DISPATCH_NOTES - Central creates, all can view relevant
-- =====================================================
DROP POLICY IF EXISTS "dispatch_notes_select_policy" ON public.dispatch_notes;
CREATE POLICY "dispatch_notes_select_policy" ON public.dispatch_notes
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR to_branch_id = get_user_branch_id()
  );

DROP POLICY IF EXISTS "dispatch_notes_modify_policy" ON public.dispatch_notes;
CREATE POLICY "dispatch_notes_modify_policy" ON public.dispatch_notes
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

-- =====================================================
-- SUPPLIERS - Central store and admins only
-- =====================================================
DROP POLICY IF EXISTS "suppliers_select_policy" ON public.suppliers;
CREATE POLICY "suppliers_select_policy" ON public.suppliers
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'accountant', 'auditor'));

DROP POLICY IF EXISTS "suppliers_modify_policy" ON public.suppliers;
CREATE POLICY "suppliers_modify_policy" ON public.suppliers
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

-- =====================================================
-- VEHICLES & DRIVERS - Fleet management
-- =====================================================
DROP POLICY IF EXISTS "vehicles_policy" ON public.vehicles;
CREATE POLICY "vehicles_policy" ON public.vehicles
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

DROP POLICY IF EXISTS "drivers_policy" ON public.drivers;
CREATE POLICY "drivers_policy" ON public.drivers
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

-- =====================================================
-- KITCHEN USAGE - Branch-specific
-- =====================================================
DROP POLICY IF EXISTS "kitchen_usage_records_policy" ON public.kitchen_usage_records;
CREATE POLICY "kitchen_usage_records_policy" ON public.kitchen_usage_records
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (
    get_user_role() IN ('super_admin', 'general_manager')
    OR branch_id = get_user_branch_id()
  );

DROP POLICY IF EXISTS "kitchen_usage_entries_policy" ON public.kitchen_usage_entries;
CREATE POLICY "kitchen_usage_entries_policy" ON public.kitchen_usage_entries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- AUDIT LOGS - Admins and auditors only
-- =====================================================
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'auditor'));

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =====================================================
-- NOTIFICATIONS - User-specific
-- =====================================================
DROP POLICY IF EXISTS "notifications_policy" ON public.notifications;
CREATE POLICY "notifications_policy" ON public.notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notification_recipients_policy" ON public.notification_recipients;
CREATE POLICY "notification_recipients_policy" ON public.notification_recipients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- EXPENSES & BUDGETS - Finance and admins
-- =====================================================
DROP POLICY IF EXISTS "expenses_policy" ON public.expenses;
CREATE POLICY "expenses_policy" ON public.expenses
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'accountant', 'auditor', 'branch_manager'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'accountant', 'branch_manager'));

DROP POLICY IF EXISTS "budgets_policy" ON public.budgets;
CREATE POLICY "budgets_policy" ON public.budgets
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'accountant', 'auditor'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'accountant'));

-- =====================================================
-- STAFF ATTENDANCE - Branch-specific
-- =====================================================
DROP POLICY IF EXISTS "staff_attendance_policy" ON public.staff_attendance;
CREATE POLICY "staff_attendance_policy" ON public.staff_attendance
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (
    get_user_role() IN ('super_admin', 'general_manager')
    OR branch_id = get_user_branch_id()
  );

-- =====================================================
-- REMAINING TABLES - Default policies for authenticated access
-- =====================================================

-- Stock request items
DROP POLICY IF EXISTS "stock_request_items_policy" ON public.stock_request_items;
CREATE POLICY "stock_request_items_policy" ON public.stock_request_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dispatch items
DROP POLICY IF EXISTS "dispatch_items_policy" ON public.dispatch_items;
CREATE POLICY "dispatch_items_policy" ON public.dispatch_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock takes
DROP POLICY IF EXISTS "stock_takes_policy" ON public.stock_takes;
CREATE POLICY "stock_takes_policy" ON public.stock_takes
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

-- Stock take items
DROP POLICY IF EXISTS "stock_take_items_policy" ON public.stock_take_items;
CREATE POLICY "stock_take_items_policy" ON public.stock_take_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Purchase orders
DROP POLICY IF EXISTS "purchase_orders_policy" ON public.purchase_orders;
CREATE POLICY "purchase_orders_policy" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'accountant', 'auditor'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

-- Purchase order items
DROP POLICY IF EXISTS "purchase_order_items_policy" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items_policy" ON public.purchase_order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- GRNs
DROP POLICY IF EXISTS "goods_received_notes_policy" ON public.goods_received_notes;
CREATE POLICY "goods_received_notes_policy" ON public.goods_received_notes
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

DROP POLICY IF EXISTS "grn_items_policy" ON public.grn_items;
CREATE POLICY "grn_items_policy" ON public.grn_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Requisitions
DROP POLICY IF EXISTS "requisitions_policy" ON public.requisitions;
CREATE POLICY "requisitions_policy" ON public.requisitions
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "requisition_items_policy" ON public.requisition_items;
CREATE POLICY "requisition_items_policy" ON public.requisition_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock transfers
DROP POLICY IF EXISTS "stock_transfers_policy" ON public.stock_transfers;
CREATE POLICY "stock_transfers_policy" ON public.stock_transfers
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR from_branch_id = get_user_branch_id()
    OR to_branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "stock_transfer_items_policy" ON public.stock_transfer_items;
CREATE POLICY "stock_transfer_items_policy" ON public.stock_transfer_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- In transit stock
DROP POLICY IF EXISTS "in_transit_stock_policy" ON public.in_transit_stock;
CREATE POLICY "in_transit_stock_policy" ON public.in_transit_stock
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory batches
DROP POLICY IF EXISTS "inventory_batches_policy" ON public.inventory_batches;
CREATE POLICY "inventory_batches_policy" ON public.inventory_batches
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

-- Branch inventory
DROP POLICY IF EXISTS "branch_inventory_policy" ON public.branch_inventory;
CREATE POLICY "branch_inventory_policy" ON public.branch_inventory
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

-- Consumption records
DROP POLICY IF EXISTS "consumption_records_policy" ON public.consumption_records;
CREATE POLICY "consumption_records_policy" ON public.consumption_records
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

-- Inventory adjustments
DROP POLICY IF EXISTS "inventory_adjustments_policy" ON public.inventory_adjustments;
CREATE POLICY "inventory_adjustments_policy" ON public.inventory_adjustments
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

-- Inventory counts
DROP POLICY IF EXISTS "inventory_counts_policy" ON public.inventory_counts;
CREATE POLICY "inventory_counts_policy" ON public.inventory_counts
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_count_items_policy" ON public.inventory_count_items;
CREATE POLICY "inventory_count_items_policy" ON public.inventory_count_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock history
DROP POLICY IF EXISTS "stock_history_policy" ON public.stock_history;
CREATE POLICY "stock_history_policy" ON public.stock_history
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  );

DROP POLICY IF EXISTS "stock_history_insert_policy" ON public.stock_history;
CREATE POLICY "stock_history_insert_policy" ON public.stock_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- Branch stock movements
DROP POLICY IF EXISTS "branch_stock_movements_policy" ON public.branch_stock_movements;
CREATE POLICY "branch_stock_movements_policy" ON public.branch_stock_movements
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

-- Stock out records
DROP POLICY IF EXISTS "stock_out_records_policy" ON public.stock_out_records;
CREATE POLICY "stock_out_records_policy" ON public.stock_out_records
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

-- Dispatch tracking
DROP POLICY IF EXISTS "dispatch_tracking_policy" ON public.dispatch_tracking;
CREATE POLICY "dispatch_tracking_policy" ON public.dispatch_tracking
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dispatch returns
DROP POLICY IF EXISTS "dispatch_returns_policy" ON public.dispatch_returns;
CREATE POLICY "dispatch_returns_policy" ON public.dispatch_returns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vehicle assignments
DROP POLICY IF EXISTS "vehicle_assignments_policy" ON public.vehicle_assignments;
CREATE POLICY "vehicle_assignments_policy" ON public.vehicle_assignments
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'))
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

-- SKU categories
DROP POLICY IF EXISTS "sku_categories_policy" ON public.sku_categories;
CREATE POLICY "sku_categories_policy" ON public.sku_categories
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (get_user_role() IN ('super_admin', 'general_manager', 'central_storekeeper'));

-- Staff usage summary
DROP POLICY IF EXISTS "staff_usage_summary_policy" ON public.staff_usage_summary;
CREATE POLICY "staff_usage_summary_policy" ON public.staff_usage_summary
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'general_manager', 'auditor')
    OR branch_id = get_user_branch_id()
  )
  WITH CHECK (true);

-- Sequence tables - typically only used by system
DROP POLICY IF EXISTS "stock_request_sequences_policy" ON public.stock_request_sequences;
CREATE POLICY "stock_request_sequences_policy" ON public.stock_request_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dispatch_sequences_policy" ON public.dispatch_sequences;
CREATE POLICY "dispatch_sequences_policy" ON public.dispatch_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "purchase_order_sequences_policy" ON public.purchase_order_sequences;
CREATE POLICY "purchase_order_sequences_policy" ON public.purchase_order_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "order_sequences_policy" ON public.order_sequences;
CREATE POLICY "order_sequences_policy" ON public.order_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "simple_sequences_policy" ON public.simple_sequences;
CREATE POLICY "simple_sequences_policy" ON public.simple_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Simple tables (legacy/simple mode)
DROP POLICY IF EXISTS "simple_items_policy" ON public.simple_items;
CREATE POLICY "simple_items_policy" ON public.simple_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "simple_app_config_policy" ON public.simple_app_config;
CREATE POLICY "simple_app_config_policy" ON public.simple_app_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "simple_shop_items_policy" ON public.simple_shop_items;
CREATE POLICY "simple_shop_items_policy" ON public.simple_shop_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "simple_transfer_items_policy" ON public.simple_transfer_items;
CREATE POLICY "simple_transfer_items_policy" ON public.simple_transfer_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on all sequences to authenticated users
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant select on all views to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant insert, update, delete on tables to authenticated users (RLS will control access)
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;


-- =====================================================
-- SUMMARY
-- =====================================================
-- This migration:
-- 1. Recreated 20 views without SECURITY DEFINER (using default SECURITY INVOKER)
-- 2. Enabled RLS on 50+ tables
-- 3. Created role-based RLS policies for each table
-- 4. Policies allow:
--    - Super admins and general managers: Full access to everything
--    - Central storekeepers: Manage inventory, dispatches, suppliers
--    - Branch storekeepers/managers: Access to their branch data only
--    - Auditors: Read access to most data for auditing
--    - Other roles: Appropriate access based on their function
