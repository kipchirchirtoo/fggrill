-- Update budgets table with missing columns
ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS name VARCHAR(100),
ADD COLUMN IF NOT EXISTS period VARCHAR(20),
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create budget_expenses table if it doesn't exist
CREATE TABLE IF NOT EXISTS budget_expenses (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
  expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT unique_budget_expense UNIQUE(budget_id, expense_id),
  CONSTRAINT valid_amount CHECK (amount >= 0)
);

-- Create budget_adjustments table for tracking changes
CREATE TABLE IF NOT EXISTS budget_adjustments (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
  previous_amount NUMERIC(12, 2) NOT NULL,
  new_amount NUMERIC(12, 2) NOT NULL,
  adjustment_amount NUMERIC(12, 2) NOT NULL,
  reason TEXT,
  adjusted_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
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
  b.spent_amount,
  b.start_date,
  b.end_date,
  b.fiscal_year,
  b.fiscal_month,
  b.status,
  (b.allocated_amount - b.spent_amount) as remaining_amount,
  CASE 
    WHEN b.allocated_amount > 0 THEN 
      ROUND((b.spent_amount / b.allocated_amount) * 100, 2)
    ELSE 0
  END as percentage_used,
  CASE
    WHEN b.allocated_amount > 0 AND b.spent_amount > b.allocated_amount THEN 'over_budget'
    WHEN b.allocated_amount > 0 AND b.spent_amount / b.allocated_amount > 0.8 THEN 'near_limit'
    ELSE 'within_budget'
  END as budget_status
FROM 
  budgets b
LEFT JOIN
  branches br ON b.branch_id = br.id
LEFT JOIN
  departments d ON b.department_id = d.id;

-- Add indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_budget_expenses_budget ON budget_expenses(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_expense ON budget_expenses(expense_id);
CREATE INDEX IF NOT EXISTS idx_budget_adjustments_budget ON budget_adjustments(budget_id);

-- Enable Row Level Security for new tables
ALTER TABLE budget_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_adjustments ENABLE ROW LEVEL SECURITY;

-- Add policies for budget_expenses
CREATE POLICY "Finance staff can view budget expenses" 
  ON budget_expenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (
        get_user_role() = ANY (ARRAY['super_admin', 'general_manager', 'accountant', 'auditor']) OR
        (get_user_role() = ANY (ARRAY['branch_manager', 'branch_operations_manager']) AND 
         get_user_branch_id() = (SELECT branch_id FROM budgets WHERE id = budget_id))
      )
    )
  );

CREATE POLICY "Finance staff can manage budget expenses" 
  ON budget_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND get_user_role() = ANY (ARRAY['super_admin', 'general_manager', 'accountant'])
    )
  );

-- Add policies for budget_adjustments
CREATE POLICY "Finance staff can view budget adjustments" 
  ON budget_adjustments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (
        get_user_role() = ANY (ARRAY['super_admin', 'general_manager', 'accountant', 'auditor']) OR
        (get_user_role() = ANY (ARRAY['branch_manager', 'branch_operations_manager']) AND 
         get_user_branch_id() = (SELECT branch_id FROM budgets WHERE id = budget_id))
      )
    )
  );

CREATE POLICY "Finance staff can manage budget adjustments" 
  ON budget_adjustments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND get_user_role() = ANY (ARRAY['super_admin', 'general_manager', 'accountant'])
    )
  );
