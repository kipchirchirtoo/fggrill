-- Create budget tables for branch operations financial management
-- This migration adds comprehensive budget tracking capabilities

-- Create budget category enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_category') THEN
    CREATE TYPE budget_category AS ENUM (
      'operations',
      'maintenance',
      'marketing',
      'supplies',
      'utilities',
      'salaries',
      'taxes',
      'insurance',
      'rent',
      'other'
    );
  END IF;
END $$;

-- Create budget period enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_period') THEN
    CREATE TYPE budget_period AS ENUM (
      'monthly',
      'quarterly',
      'yearly'
    );
  END IF;
END $$;

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id),
  department_id UUID REFERENCES departments(id),
  name VARCHAR(100) NOT NULL,
  category budget_category NOT NULL,
  period budget_period NOT NULL,
  allocated_amount DECIMAL(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fiscal_year VARCHAR(4) NOT NULL,
  fiscal_month VARCHAR(2),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_amount CHECK (allocated_amount >= 0),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Create budget expense links table
CREATE TABLE IF NOT EXISTS budget_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) NOT NULL,
  expense_id UUID REFERENCES expenses(id) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT unique_budget_expense UNIQUE(budget_id, expense_id),
  CONSTRAINT valid_amount CHECK (amount >= 0)
);

-- Create budget adjustments table for tracking changes
CREATE TABLE IF NOT EXISTS budget_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) NOT NULL,
  previous_amount DECIMAL(12, 2) NOT NULL,
  new_amount DECIMAL(12, 2) NOT NULL,
  adjustment_amount DECIMAL(12, 2) NOT NULL,
  reason TEXT,
  adjusted_by UUID REFERENCES users(id) NOT NULL,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_amounts CHECK (
    previous_amount >= 0 AND
    new_amount >= 0 AND
    adjustment_amount = new_amount - previous_amount
  )
);

-- Create budget analysis view
CREATE OR REPLACE VIEW budget_analysis AS
SELECT 
  b.id,
  b.name,
  b.branch_id,
  br.name as branch_name,
  b.department_id,
  d.name as department_name,
  b.category,
  b.period,
  b.allocated_amount,
  b.start_date,
  b.end_date,
  b.fiscal_year,
  b.fiscal_month,
  b.status,
  COALESCE(SUM(be.amount), 0) as spent_amount,
  b.allocated_amount - COALESCE(SUM(be.amount), 0) as remaining_amount,
  CASE 
    WHEN b.allocated_amount > 0 THEN 
      ROUND((COALESCE(SUM(be.amount), 0) / b.allocated_amount) * 100, 2)
    ELSE 0
  END as percentage_used,
  CASE
    WHEN b.allocated_amount > 0 AND COALESCE(SUM(be.amount), 0) > b.allocated_amount THEN 'over_budget'
    WHEN b.allocated_amount > 0 AND COALESCE(SUM(be.amount), 0) / b.allocated_amount > 0.8 THEN 'near_limit'
    ELSE 'within_budget'
  END as budget_status
FROM 
  budgets b
LEFT JOIN 
  budget_expenses be ON b.id = be.budget_id
LEFT JOIN
  branches br ON b.branch_id = br.id
LEFT JOIN
  departments d ON b.department_id = d.id
GROUP BY
  b.id, br.name, d.name;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_budgets_branch ON budgets(branch_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);
CREATE INDEX IF NOT EXISTS idx_budgets_fiscal_year ON budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_budget ON budget_expenses(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_expense ON budget_expenses(expense_id);

-- Enable Row Level Security
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_adjustments ENABLE ROW LEVEL SECURITY;

-- Set up policies
CREATE POLICY "Branch managers can view their branch budgets" 
  ON budgets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (
        role IN ('super_admin', 'general_manager', 'accountant') OR
        (role = 'branch_manager' AND branch_id = budgets.branch_id)
      )
    )
  );

CREATE POLICY "Finance staff can manage budgets" 
  ON budgets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'general_manager', 'accountant')
    )
  );

-- Budget expenses policies
CREATE POLICY "Finance staff can link expenses to budgets" 
  ON budget_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'general_manager', 'accountant')
    )
  );

-- Budget adjustments policies
CREATE POLICY "Finance staff can adjust budgets" 
  ON budget_adjustments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'general_manager', 'accountant')
    )
  );

-- No sample data - all data will come from real user input
