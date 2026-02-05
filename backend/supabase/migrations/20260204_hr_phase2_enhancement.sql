-- Phase 2 HR & Payroll Enhancements

-- 1. Employment History Table
CREATE TABLE IF NOT EXISTS staff_employment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE NOT NULL,
    change_type TEXT NOT NULL, -- promotion, department_transfer, salary_adjustment, termination, etc.
    old_value TEXT,
    new_value TEXT,
    effective_date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES users(id)
);

-- 2. Staff Documents Table
CREATE TABLE IF NOT EXISTS staff_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE NOT NULL,
    document_type TEXT NOT NULL, -- national_id, contract, cv, certificate, etc.
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Enhance Staff Profiles
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES staff_profiles(id),
ADD COLUMN IF NOT EXISTS archive_notes TEXT;

-- 3. Enhance Staff Payroll
ALTER TABLE staff_payroll
ADD COLUMN IF NOT EXISTS absence_penalties DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_deductions DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_allowances DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_leave_deduction DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS finance_transaction_id UUID; -- REFERENCES finance_transactions(id) if exists

-- Index for history
CREATE INDEX IF NOT EXISTS idx_staff_history_staff_id ON staff_employment_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_staff_id ON staff_documents(staff_id);

-- Enable RLS for history
ALTER TABLE staff_employment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view all history"
  ON staff_employment_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'hr_manager')
    )
  );

CREATE POLICY "Management can manage history"
  ON staff_employment_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'hr_manager')
    )
  );

CREATE POLICY "Management can view all documents"
  ON staff_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'hr_manager')
    )
  );

CREATE POLICY "Management can manage documents"
  ON staff_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'hr_manager')
    )
  );
