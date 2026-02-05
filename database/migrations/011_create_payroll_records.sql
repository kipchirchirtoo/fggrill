-- Create payroll_records table for HR management
CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES staff_profiles(id) NOT NULL,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  basic_salary DECIMAL(10, 2) NOT NULL,
  allowances DECIMAL(10, 2) DEFAULT 0,
  overtime DECIMAL(10, 2) DEFAULT 0,
  bonuses DECIMAL(10, 2) DEFAULT 0,
  gross_pay DECIMAL(10, 2) NOT NULL,
  tax_deductions DECIMAL(10, 2) DEFAULT 0,
  nhif_deductions DECIMAL(10, 2) DEFAULT 0,
  nssf_deductions DECIMAL(10, 2) DEFAULT 0,
  other_deductions DECIMAL(10, 2) DEFAULT 0,
  total_deductions DECIMAL(10, 2) NOT NULL,
  net_pay DECIMAL(10, 2) NOT NULL,
  payment_status TEXT DEFAULT 'pending' NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  payment_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_dates CHECK (pay_period_end >= pay_period_start),
  CONSTRAINT valid_status CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Enable RLS
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff can view their own payroll records"
  ON payroll_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = employee_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view all payroll records"
  ON payroll_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'general_manager', 'hr_manager', 'accountant')
    )
  );

CREATE POLICY "HR and Admin can manage payroll records"
  ON payroll_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'general_manager', 'hr_manager')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payroll_record_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for timestamp updates
CREATE TRIGGER update_payroll_record_timestamp
  BEFORE UPDATE ON payroll_records
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_record_timestamp();
