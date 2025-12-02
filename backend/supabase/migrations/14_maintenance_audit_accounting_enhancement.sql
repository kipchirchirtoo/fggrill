-- =====================================================
-- MAINTENANCE, AUDITOR & ACCOUNTING ENHANCEMENT
-- =====================================================

-- ============ MAINTENANCE MODULE ENHANCEMENTS ============

-- Assets and Equipment
CREATE TABLE IF NOT EXISTS maintenance_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_tag TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  location TEXT NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  purchase_date DATE,
  purchase_cost DECIMAL(10, 2),
  warranty_expiry DATE,
  depreciation_rate DECIMAL(5, 2),
  current_value DECIMAL(10, 2),
  status TEXT DEFAULT 'operational',
  criticality TEXT DEFAULT 'medium',
  maintenance_interval_days INTEGER,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  qr_code TEXT,
  barcode TEXT,
  specifications JSONB,
  manuals_url TEXT,
  energy_consumption_kwh DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Preventive Maintenance Schedules
CREATE TABLE IF NOT EXISTS maintenance_preventive_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES maintenance_assets(id),
  schedule_name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  interval_days INTEGER,
  last_performed DATE,
  next_due DATE NOT NULL,
  checklist JSONB,
  estimated_duration_minutes INTEGER,
  assigned_technician_id UUID REFERENCES staff_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Spare Parts Inventory
CREATE TABLE IF NOT EXISTS maintenance_spare_parts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_number TEXT NOT NULL UNIQUE,
  part_name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  min_stock_level INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  max_stock_level INTEGER,
  reorder_point INTEGER,
  unit_cost DECIMAL(10, 2),
  supplier_id UUID,
  location TEXT,
  compatible_assets UUID[],
  specifications JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Parts Usage/Transactions
CREATE TABLE IF NOT EXISTS maintenance_parts_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES maintenance_spare_parts(id),
  work_order_id UUID,
  transaction_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  performed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contractors/Vendors
CREATE TABLE IF NOT EXISTS maintenance_contractors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  specialization TEXT[],
  rating DECIMAL(3, 2),
  sla_response_time_hours INTEGER,
  contract_expiry DATE,
  insurance_expiry DATE,
  certifications JSONB,
  is_active BOOLEAN DEFAULT true,
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Energy/Utility Tracking
CREATE TABLE IF NOT EXISTS maintenance_meter_readings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meter_type TEXT NOT NULL,
  location TEXT NOT NULL,
  reading_value DECIMAL(10, 2) NOT NULL,
  reading_date TIMESTAMP WITH TIME ZONE NOT NULL,
  recorded_by UUID REFERENCES users(id),
  unit TEXT,
  cost DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work Order Attachments
CREATE TABLE IF NOT EXISTS maintenance_work_order_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ AUDITOR MODULE ============

-- Night Audit Sessions
CREATE TABLE IF NOT EXISTS audit_night_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_date DATE NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  performed_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  total_revenue DECIMAL(12, 2),
  total_payments DECIMAL(12, 2),
  occupancy_percentage DECIMAL(5, 2),
  adr DECIMAL(10, 2),
  revpar DECIMAL(10, 2),
  discrepancies_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Exceptions
CREATE TABLE IF NOT EXISTS audit_exceptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_session_id UUID REFERENCES audit_night_sessions(id),
  exception_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2),
  reference_type TEXT,
  reference_id UUID,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Trail Log
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Internal Audit Plans
CREATE TABLE IF NOT EXISTS audit_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_name TEXT NOT NULL,
  audit_type TEXT NOT NULL,
  department TEXT,
  planned_date DATE NOT NULL,
  auditor_id UUID REFERENCES users(id),
  scope TEXT,
  objectives TEXT[],
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Audit Findings
CREATE TABLE IF NOT EXISTS audit_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_plan_id UUID REFERENCES audit_plans(id),
  finding_number TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT,
  recommendation TEXT,
  management_response TEXT,
  action_plan TEXT,
  responsible_person UUID REFERENCES users(id),
  due_date DATE,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- ============ ACCOUNTING MODULE ============

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounting_chart_of_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  parent_account_id UUID REFERENCES accounting_chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  balance DECIMAL(15, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  tax_code TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Journal Entries
CREATE TABLE IF NOT EXISTS accounting_journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_number TEXT NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  total_debit DECIMAL(15, 2) NOT NULL,
  total_credit DECIMAL(15, 2) NOT NULL,
  status TEXT DEFAULT 'draft',
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMP WITH TIME ZONE,
  reversed_at TIMESTAMP WITH TIME ZONE,
  reversed_by UUID REFERENCES users(id),
  reversal_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT balanced_entry CHECK (total_debit = total_credit)
);

-- Journal Entry Lines
CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounting_chart_of_accounts(id),
  description TEXT,
  debit_amount DECIMAL(15, 2) DEFAULT 0,
  credit_amount DECIMAL(15, 2) DEFAULT 0,
  department TEXT,
  cost_center TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers (AR)
CREATE TABLE IF NOT EXISTS accounting_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  credit_limit DECIMAL(12, 2) DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 30,
  current_balance DECIMAL(12, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Vendors (AP)
CREATE TABLE IF NOT EXISTS accounting_vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_code TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  payment_terms_days INTEGER DEFAULT 30,
  current_balance DECIMAL(12, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- AR Invoices
CREATE TABLE IF NOT EXISTS accounting_ar_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES accounting_customers(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  balance DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- AP Bills  
CREATE TABLE IF NOT EXISTS accounting_ap_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_number TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES accounting_vendors(id),
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  balance DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS accounting_bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_number TEXT NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT,
  currency TEXT DEFAULT 'USD',
  current_balance DECIMAL(15, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Bank Transactions
CREATE TABLE IF NOT EXISTS accounting_bank_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID REFERENCES accounting_bank_accounts(id),
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  debit_amount DECIMAL(15, 2) DEFAULT 0,
  credit_amount DECIMAL(15, 2) DEFAULT 0,
  balance DECIMAL(15, 2),
  reference TEXT,
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budgets
CREATE TABLE IF NOT EXISTS accounting_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  department TEXT,
  account_id UUID REFERENCES accounting_chart_of_accounts(id),
  budget_amount DECIMAL(15, 2) NOT NULL,
  actual_amount DECIMAL(15, 2) DEFAULT 0,
  variance DECIMAL(15, 2),
  period TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Fiscal Periods
CREATE TABLE IF NOT EXISTS accounting_fiscal_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  status TEXT DEFAULT 'open',
  closed_by UUID REFERENCES users(id),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_maintenance_assets_status ON maintenance_assets(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_assets_branch ON maintenance_assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_preventive_next_due ON maintenance_preventive_schedules(next_due);
CREATE INDEX IF NOT EXISTS idx_audit_exceptions_status ON audit_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_date ON accounting_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_ar_invoices_customer ON accounting_ar_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_accounting_ap_bills_vendor ON accounting_ap_bills(vendor_id);

-- ============ ENABLE RLS ============

ALTER TABLE maintenance_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_preventive_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_night_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_vendors ENABLE ROW LEVEL SECURITY;

-- ============ SAMPLE DATA ============

INSERT INTO maintenance_spare_parts (part_number, part_name, category, unit, current_stock, min_stock_level)
VALUES 
  ('HVAC-FILTER-001', 'HVAC Air Filter', 'HVAC', 'piece', 10, 5),
  ('PLUMB-PIPE-01', 'PVC Pipe 2 inch', 'Plumbing', 'meter', 50, 20)
ON CONFLICT DO NOTHING;

INSERT INTO accounting_chart_of_accounts (account_code, account_name, account_type)
VALUES 
  ('1000', 'Cash', 'asset'),
  ('2000', 'Accounts Payable', 'liability'),
  ('3000', 'Revenue', 'income'),
  ('4000', 'Expenses', 'expense')
ON CONFLICT DO NOTHING;
