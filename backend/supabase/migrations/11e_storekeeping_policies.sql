-- =====================================================
-- STOREKEEPING MODULE - ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE store_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_item_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_item_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_supplier_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_grn ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_issue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_physical_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_count_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DEPARTMENTS POLICIES
-- =====================================================

CREATE POLICY "Staff can view departments"
  ON store_departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Admins can manage departments"
  ON store_departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- =====================================================
-- LOCATIONS POLICIES
-- =====================================================

CREATE POLICY "Staff can view locations"
  ON store_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Admins can manage locations"
  ON store_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- ITEMS POLICIES
-- =====================================================

CREATE POLICY "Staff can view items"
  ON store_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage items"
  ON store_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- SUPPLIERS POLICIES
-- =====================================================

CREATE POLICY "Staff can view suppliers"
  ON store_suppliers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Authorized staff can manage suppliers"
  ON store_suppliers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- PURCHASE REQUISITIONS POLICIES
-- =====================================================

CREATE POLICY "Department staff can view their requisitions"
  ON store_purchase_requisitions FOR SELECT
  USING (
    auth.uid() = requested_by_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Staff can create requisitions"
  ON store_purchase_requisitions FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Managers can update requisitions"
  ON store_purchase_requisitions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- PURCHASE ORDERS POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view purchase orders"
  ON store_purchase_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage purchase orders"
  ON store_purchase_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- GRN POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view GRN"
  ON store_grn FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage GRN"
  ON store_grn FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- STOCK MOVEMENTS POLICIES
-- =====================================================

CREATE POLICY "Staff can view stock movements"
  ON store_stock_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper', 'housekeeping', 'maintenance', 'restaurant')
    )
  );

CREATE POLICY "Storekeepers can create stock movements"
  ON store_stock_movements FOR INSERT
  WITH CHECK (
    auth.uid() = performed_by_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- STOCK ISSUES POLICIES
-- =====================================================

CREATE POLICY "Department staff can view their issues"
  ON store_stock_issues FOR SELECT
  USING (
    auth.uid() = requested_by_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Staff can create stock issues"
  ON store_stock_issues FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping', 'maintenance', 'restaurant', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage stock issues"
  ON store_stock_issues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- STOCK TRANSFERS POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view transfers"
  ON store_stock_transfers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage transfers"
  ON store_stock_transfers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- STOCK ADJUSTMENTS POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view adjustments"
  ON store_stock_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can create adjustments"
  ON store_stock_adjustments FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Managers can approve adjustments"
  ON store_stock_adjustments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- =====================================================
-- PHYSICAL COUNTS POLICIES
-- =====================================================

CREATE POLICY "Authorized staff can view counts"
  ON store_physical_counts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

CREATE POLICY "Storekeepers can manage counts"
  ON store_physical_counts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'storekeeper')
    )
  );

-- =====================================================
-- CHILD TABLES POLICIES (inherit from parent)
-- =====================================================

-- Item suppliers
CREATE POLICY "Inherit from items" ON store_item_suppliers FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Item batches
CREATE POLICY "Inherit from items" ON store_item_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Supplier quotations
CREATE POLICY "Inherit from suppliers" ON store_supplier_quotations FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Supplier performance
CREATE POLICY "Inherit from suppliers" ON store_supplier_performance FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Requisition items
CREATE POLICY "Inherit from requisitions" ON store_requisition_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper', 'housekeeping', 'maintenance', 'restaurant')));

-- PO items
CREATE POLICY "Inherit from PO" ON store_po_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- GRN items
CREATE POLICY "Inherit from GRN" ON store_grn_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Issue items
CREATE POLICY "Inherit from issues" ON store_issue_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper', 'housekeeping', 'maintenance', 'restaurant')));

-- Return items
CREATE POLICY "Inherit from returns" ON store_return_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper', 'housekeeping', 'maintenance', 'restaurant')));

-- Transfer items
CREATE POLICY "Inherit from transfers" ON store_transfer_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Adjustment items
CREATE POLICY "Inherit from adjustments" ON store_adjustment_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));

-- Count items
CREATE POLICY "Inherit from counts" ON store_count_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'storekeeper')));
