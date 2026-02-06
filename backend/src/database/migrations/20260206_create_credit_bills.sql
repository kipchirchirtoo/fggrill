-- Create credit_bills table
CREATE TABLE credit_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  
  -- Confirmation Workflow
  accountant_confirmed_at TIMESTAMP WITH TIME ZONE,
  accountant_id UUID REFERENCES users(id),
  auditor_confirmed_at TIMESTAMP WITH TIME ZONE,
  auditor_id UUID REFERENCES users(id),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled'))
);

-- Enable RLS
ALTER TABLE credit_bills ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Staff can view their own bills
CREATE POLICY "Staff can view their own credit bills"
  ON credit_bills
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

-- 2. Management (Accountant, Auditor, Admin) can view all
CREATE POLICY "Management can view all credit bills"
  ON credit_bills
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant', 'auditor')
    )
  );

-- 3. Management can update (confirm) bills
CREATE POLICY "Management can manage credit bills"
  ON credit_bills
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant', 'auditor')
    )
  );

-- Triggers for timestamps
CREATE TRIGGER update_credit_bills_timestamp
  BEFORE UPDATE ON credit_bills
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_profile_timestamp();
