-- Create transaction type enum
CREATE TYPE transaction_type AS ENUM (
  'income',
  'expense'
);

-- Create payment method enum
CREATE TYPE payment_method AS ENUM (
  'cash',
  'card',
  'mpesa',
  'bank_transfer',
  'cheque'
);

-- Create payment status enum
CREATE TYPE payment_status AS ENUM (
  'pending',
  'completed',
  'failed',
  'refunded'
);

-- Create expense category enum
CREATE TYPE expense_category AS ENUM (
  'salaries',
  'utilities',
  'supplies',
  'maintenance',
  'marketing',
  'taxes',
  'insurance',
  'rent',
  'other'
);

-- Create invoice status enum
CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
);

-- Create transactions table
CREATE TABLE finance_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_number TEXT NOT NULL UNIQUE,
  transaction_type transaction_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  category expense_category,
  reference_type TEXT, -- e.g., 'booking', 'order', 'invoice'
  reference_id UUID,
  payment_method payment_method,
  payment_status payment_status DEFAULT 'pending' NOT NULL,
  payment_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  payment_date TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_expense_category CHECK (
    (transaction_type = 'expense' AND category IS NOT NULL) OR
    (transaction_type = 'income' AND category IS NULL)
  )
);

-- Create invoices table
CREATE TABLE finance_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  guest_id UUID REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  status invoice_status DEFAULT 'draft' NOT NULL,
  due_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_amounts CHECK (
    total_amount > 0 AND
    paid_amount >= 0 AND
    paid_amount <= total_amount
  )
);

-- Create invoice items table
CREATE TABLE finance_invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES finance_invoices(id) NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_prices CHECK (
    unit_price > 0 AND
    total_price = quantity * unit_price
  )
);

-- Create payments table
CREATE TABLE finance_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_number TEXT NOT NULL UNIQUE,
  invoice_id UUID REFERENCES finance_invoices(id),
  booking_id UUID REFERENCES bookings(id),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  status payment_status DEFAULT 'pending' NOT NULL,
  payment_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,

  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_reference CHECK (
    (invoice_id IS NOT NULL AND booking_id IS NULL) OR
    (booking_id IS NOT NULL AND invoice_id IS NULL)
  )
);

-- Enable RLS
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payments ENABLE ROW LEVEL SECURITY;

-- Transaction policies
CREATE POLICY "Staff can view transactions"
  ON finance_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant')
    )
  );

CREATE POLICY "Staff can manage transactions"
  ON finance_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant')
    )
  );

-- Invoice policies
CREATE POLICY "Staff can view all invoices"
  ON finance_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant', 'receptionist')
    )
  );

CREATE POLICY "Guests can view their own invoices"
  ON finance_invoices
  FOR SELECT
  USING (auth.uid() = guest_id);

CREATE POLICY "Staff can manage invoices"
  ON finance_invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant')
    )
  );

-- Invoice items policies
CREATE POLICY "Staff can view all invoice items"
  ON finance_invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant', 'receptionist')
    )
  );

CREATE POLICY "Guests can view their own invoice items"
  ON finance_invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM finance_invoices 
      WHERE id = invoice_id 
      AND guest_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage invoice items"
  ON finance_invoice_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant')
    )
  );

-- Payment policies
CREATE POLICY "Staff can view all payments"
  ON finance_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant', 'receptionist')
    )
  );

CREATE POLICY "Guests can view their own payments"
  ON finance_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM finance_invoices 
      WHERE id = invoice_id 
      AND guest_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookings 
      WHERE id = booking_id 
      AND guest_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage payments"
  ON finance_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant')
    )
  );

-- Create function to generate transaction number
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TEXT AS $$
DECLARE
  trans_date TEXT;
  trans_seq INT;
  trans_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  trans_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM finance_transactions
    WHERE transaction_number LIKE 'TXN' || trans_date || '%'
  )
  SELECT next_seq INTO trans_seq FROM seq;
  
  -- Generate transaction number
  trans_number := 'TXN' || trans_date || LPAD(trans_seq::TEXT, 4, '0');
  
  RETURN trans_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  inv_date TEXT;
  inv_seq INT;
  inv_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  inv_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM finance_invoices
    WHERE invoice_number LIKE 'INV' || inv_date || '%'
  )
  SELECT next_seq INTO inv_seq FROM seq;
  
  -- Generate invoice number
  inv_number := 'INV' || inv_date || LPAD(inv_seq::TEXT, 4, '0');
  
  RETURN inv_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate payment number
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
DECLARE
  pay_date TEXT;
  pay_seq INT;
  pay_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  pay_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM finance_payments
    WHERE payment_number LIKE 'PAY' || pay_date || '%'
  )
  SELECT next_seq INTO pay_seq FROM seq;
  
  -- Generate payment number
  pay_number := 'PAY' || pay_date || LPAD(pay_seq::TEXT, 4, '0');
  
  RETURN pay_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to update invoice status
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total paid amount
  WITH paid_total AS (
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM finance_payments
    WHERE invoice_id = NEW.invoice_id
    AND status = 'completed'
  )
  UPDATE finance_invoices
  SET 
    paid_amount = paid_total.total_paid,
    status = CASE 
      WHEN paid_total.total_paid >= finance_invoices.total_amount THEN 'paid'
      WHEN NOW() > finance_invoices.due_date THEN 'overdue'
      ELSE status
    END,
    paid_at = CASE 
      WHEN paid_total.total_paid >= finance_invoices.total_amount THEN NOW()
      ELSE paid_at
    END,
    updated_at = NOW()
  FROM paid_total
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice status updates
CREATE TRIGGER update_invoice_status
  AFTER INSERT OR UPDATE ON finance_payments
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION update_invoice_status();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_finance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_transaction_timestamp
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_timestamp();

CREATE TRIGGER update_invoice_timestamp
  BEFORE UPDATE ON finance_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_timestamp();

CREATE TRIGGER update_payment_timestamp
  BEFORE UPDATE ON finance_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_timestamp();
