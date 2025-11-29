-- =====================================================
-- MULTI-BRANCH IMPLEMENTATION
-- Add branch_id to all remaining transactional and master tables
-- =====================================================

-- 1. RESTAURANT MODULE
-- =====================================================

-- Add branch_id to restaurant_orders
ALTER TABLE restaurant_orders 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch ON restaurant_orders(branch_id);

-- Add branch_id to restaurant_inventory_items
-- Note: Inventory items might be specific to a branch, or global catalog. 
-- Assuming simple model where items are per branch for tracking stock.
-- If global items exist, we might need a separate 'restaurant_branch_inventory' table, 
-- but for now adding branch_id allows isolating stock per branch.
ALTER TABLE restaurant_inventory_items 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_restaurant_inv_items_branch ON restaurant_inventory_items(branch_id);

-- Add branch_id to restaurant_inventory_transactions
ALTER TABLE restaurant_inventory_transactions 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_restaurant_inv_trans_branch ON restaurant_inventory_transactions(branch_id);

-- Update RLS policies for Restaurant
DROP POLICY IF EXISTS "Staff can view all orders" ON restaurant_orders;
CREATE POLICY "Staff can view branch orders" ON restaurant_orders FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.branch_id = restaurant_orders.branch_id
    AND role IN ('manager', 'restaurant', 'receptionist')
  )) OR
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND role = 'super_admin'
  ))
);

DROP POLICY IF EXISTS "Staff can create orders" ON restaurant_orders;
CREATE POLICY "Staff can create branch orders" ON restaurant_orders FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.branch_id = branch_id
    AND role IN ('manager', 'restaurant', 'receptionist')
  )) OR
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND role = 'super_admin'
  ))
);

-- 2. BOOKINGS MODULE
-- =====================================================

-- Add branch_id to bookings
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bookings_branch ON bookings(branch_id);

-- Update RLS policies for Bookings
DROP POLICY IF EXISTS "Staff can view all bookings" ON bookings;
CREATE POLICY "Staff can view branch bookings" ON bookings FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.branch_id = bookings.branch_id
    AND role IN ('manager', 'receptionist')
  )) OR
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND role = 'super_admin'
  ))
);

-- 3. FINANCE MODULE
-- =====================================================

-- Add branch_id to finance_transactions
ALTER TABLE finance_transactions 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_branch ON finance_transactions(branch_id);

-- Add branch_id to finance_invoices
ALTER TABLE finance_invoices 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_invoices_branch ON finance_invoices(branch_id);

-- Add branch_id to finance_payments
ALTER TABLE finance_payments 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_payments_branch ON finance_payments(branch_id);

-- Update RLS for Finance
DROP POLICY IF EXISTS "Staff can view transactions" ON finance_transactions;
CREATE POLICY "Staff can view branch transactions" ON finance_transactions FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.branch_id = finance_transactions.branch_id
    AND role IN ('manager', 'accountant')
  )) OR
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND role = 'super_admin'
  ))
);

-- 4. HOUSEKEEPING MODULE
-- =====================================================

-- Add branch_id to housekeeping_tasks
ALTER TABLE housekeeping_tasks 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_branch ON housekeeping_tasks(branch_id);

-- Add branch_id to housekeeping_supplies
ALTER TABLE housekeeping_supplies 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_housekeeping_supplies_branch ON housekeeping_supplies(branch_id);

-- Add branch_id to housekeeping_supply_transactions
ALTER TABLE housekeeping_supply_transactions 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_housekeeping_supply_trans_branch ON housekeeping_supply_transactions(branch_id);

-- Add branch_id to housekeeping_supply_requests
ALTER TABLE housekeeping_supply_requests 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_housekeeping_supply_req_branch ON housekeeping_supply_requests(branch_id);

-- Update RLS for Housekeeping
DROP POLICY IF EXISTS "Management and supervisors can view all tasks" ON housekeeping_tasks;
CREATE POLICY "Staff can view branch tasks" ON housekeeping_tasks FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.branch_id = housekeeping_tasks.branch_id
    AND role IN ('manager', 'housekeeping')
  )) OR
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND role = 'super_admin'
  )) OR
  assigned_to IN (SELECT id FROM staff_profiles WHERE user_id = auth.uid())
);

-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to automatically set branch_id from room's branch
CREATE OR REPLACE FUNCTION set_booking_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.room_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM rooms WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_branch_id_trigger
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_booking_branch_id();

-- Function to set branch_id from user's branch for orders if not provided
CREATE OR REPLACE FUNCTION set_order_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM users WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_branch_id_trigger
BEFORE INSERT ON restaurant_orders
FOR EACH ROW
EXECUTE FUNCTION set_order_branch_id();

-- Function to set branch_id from user's branch for finance transactions
CREATE OR REPLACE FUNCTION set_finance_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM users WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_finance_branch_id_trigger
BEFORE INSERT ON finance_transactions
FOR EACH ROW
EXECUTE FUNCTION set_finance_branch_id();

CREATE TRIGGER set_invoice_branch_id_trigger
BEFORE INSERT ON finance_invoices
FOR EACH ROW
EXECUTE FUNCTION set_finance_branch_id();

CREATE TRIGGER set_payment_branch_id_trigger
BEFORE INSERT ON finance_payments
FOR EACH ROW
EXECUTE FUNCTION set_finance_branch_id();

-- Function to set branch_id from room for housekeeping tasks
CREATE OR REPLACE FUNCTION set_hk_task_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.room_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM rooms WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_hk_task_branch_id_trigger
BEFORE INSERT ON housekeeping_tasks
FOR EACH ROW
EXECUTE FUNCTION set_hk_task_branch_id();
