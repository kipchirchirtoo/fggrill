-- =====================================================
-- UNIFIED BILLING SYSTEM MIGRATION
-- =====================================================
-- This migration implements a comprehensive billing system that supports:
-- 1. Multiple orders on a single bill
-- 2. Partial payments with balance tracking
-- 3. Split bills (by items, amount, guest, seat)
-- 4. Bill status management (OPEN → CLOSED → PAID)
-- 5. Kenyan VAT calculations (16%)
-- 6. Multi-department support (Kitchen, Bar, Pool Bar, Spa)
-- 7. Full audit trails
-- =====================================================

-- ============ ENUMS ============

-- Bill status enum
CREATE TYPE bill_status AS ENUM (
  'OPEN',      -- Can add orders, cannot pay yet
  'CLOSED',    -- Cannot add orders, can pay
  'PAID',      -- Fully paid, locked
  'CANCELLED'  -- Voided, locked
);

-- Payment method enum (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_payment_method') THEN
    CREATE TYPE bill_payment_method AS ENUM (
      'CASH',
      'MPESA',
      'CARD',
      'BANK_TRANSFER',
      'CREDIT'
    );
  END IF;
END $$;

-- ============ MAIN BILLS TABLE ============

CREATE TABLE restaurant_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT UNIQUE NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  
  -- Customer Info
  table_number TEXT,
  room_number TEXT,
  guest_id UUID REFERENCES users(id),
  guest_name TEXT,
  guest_phone TEXT,
  
  -- Bill Status
  status bill_status NOT NULL DEFAULT 'OPEN',
  
  -- Financial Amounts
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(12, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- VAT Configuration
  vat_rate DECIMAL(5, 2) DEFAULT 16.00, -- Kenya VAT
  vat_inclusive BOOLEAN DEFAULT false,
  service_charge_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Split Bill Tracking
  is_split BOOLEAN DEFAULT false,
  parent_bill_id UUID REFERENCES restaurant_bills(id),
  split_type TEXT, -- 'by_items', 'by_amount', 'by_guest', 'by_seat'
  
  -- Audit Trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  
  -- Notes
  special_requests TEXT,
  internal_notes TEXT,
  
  -- Constraints
  CONSTRAINT valid_amounts CHECK (
    subtotal >= 0 AND
    vat_amount >= 0 AND
    service_charge >= 0 AND
    discount_amount >= 0 AND
    total_amount >= 0 AND
    paid_amount >= 0 AND
    paid_amount <= total_amount AND
    balance >= 0 AND
    balance = total_amount - paid_amount
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('OPEN', 'CLOSED', 'PAID', 'CANCELLED')
  ),
  CONSTRAINT valid_location CHECK (
    (table_number IS NOT NULL AND room_number IS NULL) OR
    (room_number IS NOT NULL AND table_number IS NULL) OR
    (table_number IS NULL AND room_number IS NULL)
  )
);

-- ============ LINK ORDERS TO BILLS ============

-- Add bill_id to existing restaurant_orders
ALTER TABLE restaurant_orders 
ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES restaurant_bills(id);

-- Add department tracking for multi-department support
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'restaurant';

-- Add constraint for department values
ALTER TABLE restaurant_orders
ADD CONSTRAINT valid_department CHECK (
  department IN ('restaurant', 'bar', 'pool_bar', 'spa', 'room_service')
);

-- ============ BILL PAYMENTS TABLE ============

CREATE TABLE restaurant_bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES restaurant_bills(id) NOT NULL,
  
  -- Payment Details
  payment_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method bill_payment_method NOT NULL,
  payment_reference TEXT, -- M-Pesa code, card transaction ID, etc.
  
  -- Audit Trail
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by UUID REFERENCES users(id),
  cashier_id UUID REFERENCES staff_profiles(id),
  
  -- Reversal Support
  reversed BOOLEAN DEFAULT false,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users(id),
  reversal_reason TEXT,
  reversal_payment_id UUID REFERENCES restaurant_bill_payments(id),
  
  -- Notes
  notes TEXT,
  
  CONSTRAINT valid_amount CHECK (amount > 0)
);

-- ============ BILL AUDIT LOG ============

CREATE TABLE restaurant_bill_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES restaurant_bills(id) NOT NULL,
  
  -- Action Details
  action TEXT NOT NULL, -- 'created', 'order_added', 'payment_received', 'closed', 'split', 'cancelled'
  description TEXT NOT NULL,
  
  -- Before/After State
  old_status bill_status,
  new_status bill_status,
  old_total DECIMAL(12, 2),
  new_total DECIMAL(12, 2),
  old_balance DECIMAL(12, 2),
  new_balance DECIMAL(12, 2),
  
  -- Audit
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Additional Data (JSON)
  metadata JSONB
);

-- ============ INDEXES ============

-- Bills indexes
CREATE INDEX idx_bills_status ON restaurant_bills(status, branch_id);
CREATE INDEX idx_bills_table ON restaurant_bills(table_number, branch_id) WHERE table_number IS NOT NULL;
CREATE INDEX idx_bills_room ON restaurant_bills(room_number, branch_id) WHERE room_number IS NOT NULL;
CREATE INDEX idx_bills_guest ON restaurant_bills(guest_name, branch_id) WHERE guest_name IS NOT NULL;
CREATE INDEX idx_bills_created_at ON restaurant_bills(created_at);
CREATE INDEX idx_bills_parent ON restaurant_bills(parent_bill_id) WHERE parent_bill_id IS NOT NULL;

-- Orders to bills link
CREATE INDEX idx_orders_bill ON restaurant_orders(bill_id) WHERE bill_id IS NOT NULL;
CREATE INDEX idx_orders_department ON restaurant_orders(department);

-- Payments indexes
CREATE INDEX idx_bill_payments_bill ON restaurant_bill_payments(bill_id);
CREATE INDEX idx_bill_payments_date ON restaurant_bill_payments(paid_at);
CREATE INDEX idx_bill_payments_method ON restaurant_bill_payments(payment_method);
CREATE INDEX idx_bill_payments_reversed ON restaurant_bill_payments(reversed);

-- Audit log index
CREATE INDEX idx_bill_audit_bill ON restaurant_bill_audit_log(bill_id);
CREATE INDEX idx_bill_audit_date ON restaurant_bill_audit_log(performed_at);

-- ============ FUNCTIONS ============

-- Function to generate bill number
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  bill_date TEXT;
  bill_seq INT;
  bill_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  bill_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM restaurant_bills
    WHERE bill_number LIKE 'BILL' || bill_date || '%'
  )
  SELECT next_seq INTO bill_seq FROM seq;
  
  -- Generate bill number
  bill_number := 'BILL' || bill_date || LPAD(bill_seq::TEXT, 4, '0');
  
  RETURN bill_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate payment number
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
DECLARE
  pay_date TEXT;
  pay_seq INT;
  pay_number TEXT;
BEGIN
  pay_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM restaurant_bill_payments
    WHERE payment_number LIKE 'PAY' || pay_date || '%'
  )
  SELECT next_seq INTO pay_seq FROM seq;
  
  pay_number := 'PAY' || pay_date || LPAD(pay_seq::TEXT, 4, '0');
  
  RETURN pay_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate bill totals with VAT
CREATE OR REPLACE FUNCTION calculate_bill_totals(p_bill_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal DECIMAL(12, 2);
  v_vat_rate DECIMAL(5, 2);
  v_service_charge_rate DECIMAL(5, 2);
  v_vat_amount DECIMAL(12, 2);
  v_service_charge DECIMAL(12, 2);
  v_discount DECIMAL(12, 2);
  v_total DECIMAL(12, 2);
  v_paid DECIMAL(12, 2);
  v_balance DECIMAL(12, 2);
BEGIN
  -- Get bill configuration
  SELECT vat_rate, service_charge_rate, discount_amount, paid_amount
  INTO v_vat_rate, v_service_charge_rate, v_discount, v_paid
  FROM restaurant_bills
  WHERE id = p_bill_id;
  
  -- Calculate subtotal from all orders
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_subtotal
  FROM restaurant_orders
  WHERE bill_id = p_bill_id
  AND status != 'cancelled';
  
  -- Calculate service charge
  v_service_charge := v_subtotal * (v_service_charge_rate / 100);
  
  -- Calculate VAT on subtotal + service charge
  v_vat_amount := (v_subtotal + v_service_charge) * (v_vat_rate / 100);
  
  -- Calculate total
  v_total := v_subtotal + v_service_charge + v_vat_amount - v_discount;
  
  -- Calculate balance
  v_balance := v_total - v_paid;
  
  -- Update bill
  UPDATE restaurant_bills
  SET 
    subtotal = v_subtotal,
    service_charge = v_service_charge,
    vat_amount = v_vat_amount,
    total_amount = v_total,
    balance = v_balance,
    updated_at = NOW()
  WHERE id = p_bill_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update bill status based on payments
CREATE OR REPLACE FUNCTION update_bill_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_bill_id UUID;
  v_total DECIMAL(12, 2);
  v_paid DECIMAL(12, 2);
  v_balance DECIMAL(12, 2);
  v_old_status bill_status;
  v_new_status bill_status;
BEGIN
  -- Get bill ID
  v_bill_id := NEW.bill_id;
  
  -- Calculate total paid amount
  SELECT 
    b.total_amount,
    COALESCE(SUM(p.amount), 0),
    b.status
  INTO v_total, v_paid, v_old_status
  FROM restaurant_bills b
  LEFT JOIN restaurant_bill_payments p ON p.bill_id = b.id AND p.reversed = false
  WHERE b.id = v_bill_id
  GROUP BY b.id, b.total_amount, b.status;
  
  v_balance := v_total - v_paid;
  
  -- Determine new status
  IF v_balance <= 0 THEN
    v_new_status := 'PAID';
  ELSIF v_old_status = 'OPEN' AND v_paid > 0 THEN
    v_new_status := 'CLOSED'; -- First payment closes the bill
  ELSE
    v_new_status := v_old_status;
  END IF;
  
  -- Update bill
  UPDATE restaurant_bills
  SET 
    paid_amount = v_paid,
    balance = v_balance,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'PAID' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE id = v_bill_id;
  
  -- Log audit trail
  IF v_old_status != v_new_status THEN
    INSERT INTO restaurant_bill_audit_log (
      bill_id, action, description, old_status, new_status,
      old_balance, new_balance, performed_by
    ) VALUES (
      v_bill_id, 'payment_received', 
      'Payment of ' || NEW.amount || ' received via ' || NEW.payment_method,
      v_old_status, v_new_status, v_balance + NEW.amount, v_balance,
      NEW.paid_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent modifications to paid bills
CREATE OR REPLACE FUNCTION prevent_paid_bill_modifications()
RETURNS TRIGGER AS $$
DECLARE
  v_bill_status bill_status;
BEGIN
  -- Get bill status
  SELECT status INTO v_bill_status
  FROM restaurant_bills
  WHERE id = NEW.bill_id;
  
  -- Prevent adding orders to paid or cancelled bills
  IF v_bill_status IN ('PAID', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot add orders to % bills', v_bill_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log bill modifications
CREATE OR REPLACE FUNCTION log_bill_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO restaurant_bill_audit_log (
      bill_id, action, description, new_status, new_total, new_balance, performed_by
    ) VALUES (
      NEW.id, 'created', 'Bill created', NEW.status, NEW.total_amount, NEW.balance, NEW.created_by
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status OR OLD.total_amount != NEW.total_amount THEN
      INSERT INTO restaurant_bill_audit_log (
        bill_id, action, description, 
        old_status, new_status, old_total, new_total, old_balance, new_balance,
        performed_by
      ) VALUES (
        NEW.id, 'updated', 'Bill modified',
        OLD.status, NEW.status, OLD.total_amount, NEW.total_amount, 
        OLD.balance, NEW.balance, NEW.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============ TRIGGERS ============

-- Trigger to update bill totals when orders change
CREATE TRIGGER update_bill_totals_on_order_change
  AFTER INSERT OR UPDATE OR DELETE ON restaurant_orders
  FOR EACH ROW
  WHEN (NEW.bill_id IS NOT NULL OR OLD.bill_id IS NOT NULL)
  EXECUTE FUNCTION calculate_bill_totals(COALESCE(NEW.bill_id, OLD.bill_id));

-- Trigger to update bill status on payment
CREATE TRIGGER update_bill_status_on_payment_trigger
  AFTER INSERT ON restaurant_bill_payments
  FOR EACH ROW
  WHEN (NEW.reversed = false)
  EXECUTE FUNCTION update_bill_status_on_payment();

-- Trigger to prevent modifications to paid bills
CREATE TRIGGER prevent_paid_bill_modifications_trigger
  BEFORE INSERT ON restaurant_orders
  FOR EACH ROW
  WHEN (NEW.bill_id IS NOT NULL)
  EXECUTE FUNCTION prevent_paid_bill_modifications();

-- Trigger to log bill modifications
CREATE TRIGGER log_bill_modification_trigger
  AFTER INSERT OR UPDATE ON restaurant_bills
  FOR EACH ROW
  EXECUTE FUNCTION log_bill_modification();

-- ============ ROW LEVEL SECURITY ============

ALTER TABLE restaurant_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_bill_audit_log ENABLE ROW LEVEL SECURITY;

-- Bills policies
CREATE POLICY "Staff can view bills"
  ON restaurant_bills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant', 'receptionist', 'cashier', 'branch_manager')
    )
  );

CREATE POLICY "Staff can create bills"
  ON restaurant_bills FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant', 'receptionist', 'cashier')
    )
  );

CREATE POLICY "Staff can update bills"
  ON restaurant_bills FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant', 'cashier')
    )
  );

-- Payments policies
CREATE POLICY "Staff can view payments"
  ON restaurant_bill_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'cashier', 'auditor', 'branch_accountant')
    )
  );

CREATE POLICY "Cashiers can create payments"
  ON restaurant_bill_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'cashier')
    )
  );

-- Audit log policies
CREATE POLICY "Staff can view audit logs"
  ON restaurant_bill_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'auditor', 'branch_accountant')
    )
  );

-- ============ MIGRATION DATA ============

-- Migrate existing orders to bills (1 order = 1 bill initially)
-- This will be done in a separate migration script to avoid data loss

COMMENT ON TABLE restaurant_bills IS 'Unified billing system supporting multiple orders, partial payments, and split bills';
COMMENT ON TABLE restaurant_bill_payments IS 'Payment records for bills with reversal support';
COMMENT ON TABLE restaurant_bill_audit_log IS 'Comprehensive audit trail for all bill modifications';

-- ============ GRANT PERMISSIONS ============

-- Grant necessary permissions to service role
GRANT ALL ON restaurant_bills TO service_role;
GRANT ALL ON restaurant_bill_payments TO service_role;
GRANT ALL ON restaurant_bill_audit_log TO service_role;

