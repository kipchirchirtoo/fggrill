-- Safe additive migration: add new columns WITHOUT removing old ones
-- This keeps all existing APIs working while enabling the new payroll system

-- staff_credit_bills: add status, bill_date, deducted_in_payroll_id (keep is_paid, date, payroll_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'bill_date') THEN
        ALTER TABLE staff_credit_bills ADD COLUMN bill_date DATE DEFAULT CURRENT_DATE;
        -- Populate from existing 'date' column if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'date') THEN
            UPDATE staff_credit_bills SET bill_date = "date" WHERE bill_date IS NULL;
        END IF;
        UPDATE staff_credit_bills SET bill_date = CURRENT_DATE WHERE bill_date IS NULL;
        ALTER TABLE staff_credit_bills ALTER COLUMN bill_date SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'status') THEN
        ALTER TABLE staff_credit_bills ADD COLUMN status TEXT DEFAULT 'pending';
        -- Migrate is_paid -> status
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'is_paid') THEN
            UPDATE staff_credit_bills SET status = CASE WHEN is_paid = TRUE THEN 'paid_cash' ELSE 'pending' END;
        END IF;
        UPDATE staff_credit_bills SET status = 'pending' WHERE status IS NULL;
        ALTER TABLE staff_credit_bills ALTER COLUMN status SET NOT NULL;
        ALTER TABLE staff_credit_bills ADD CONSTRAINT staff_credit_bills_status_check
            CHECK (status IN ('pending', 'deducted', 'cancelled', 'paid_cash'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'deducted_in_payroll_id') THEN
        ALTER TABLE staff_credit_bills ADD COLUMN deducted_in_payroll_id UUID;
        -- Populate from existing payroll_id if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'payroll_id') THEN
            UPDATE staff_credit_bills SET deducted_in_payroll_id = payroll_id WHERE payroll_id IS NOT NULL;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'branch_id') THEN
        ALTER TABLE staff_credit_bills ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;
END $$;

-- staff_advances: add advance_date, month_to_deduct, year_to_deduct, deducted_in_payroll_id (keep request_date, payroll_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_advances' AND column_name = 'advance_date') THEN
        ALTER TABLE staff_advances ADD COLUMN advance_date DATE DEFAULT CURRENT_DATE;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_advances' AND column_name = 'request_date') THEN
            UPDATE staff_advances SET advance_date = request_date WHERE advance_date IS NULL;
        END IF;
        UPDATE staff_advances SET advance_date = CURRENT_DATE WHERE advance_date IS NULL;
        ALTER TABLE staff_advances ALTER COLUMN advance_date SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_advances' AND column_name = 'month_to_deduct') THEN
        ALTER TABLE staff_advances ADD COLUMN month_to_deduct INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_advances' AND column_name = 'year_to_deduct') THEN
        ALTER TABLE staff_advances ADD COLUMN year_to_deduct INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_advances' AND column_name = 'deducted_in_payroll_id') THEN
        ALTER TABLE staff_advances ADD COLUMN deducted_in_payroll_id UUID;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_advances' AND column_name = 'payroll_id') THEN
            UPDATE staff_advances SET deducted_in_payroll_id = payroll_id WHERE payroll_id IS NOT NULL;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_advances' AND column_name = 'branch_id') THEN
        ALTER TABLE staff_advances ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;
END $$;

-- staff_loans: add installment_amount, loan_date, start_deduction_month, start_deduction_year (keep monthly_installment, start_date)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_loans' AND column_name = 'installment_amount') THEN
        ALTER TABLE staff_loans ADD COLUMN installment_amount DECIMAL(10,2);
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_loans' AND column_name = 'monthly_installment') THEN
            UPDATE staff_loans SET installment_amount = monthly_installment WHERE installment_amount IS NULL;
        END IF;
        UPDATE staff_loans SET installment_amount = 0 WHERE installment_amount IS NULL;
        ALTER TABLE staff_loans ALTER COLUMN installment_amount SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_loans' AND column_name = 'loan_date') THEN
        ALTER TABLE staff_loans ADD COLUMN loan_date DATE DEFAULT CURRENT_DATE;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_loans' AND column_name = 'start_date') THEN
            UPDATE staff_loans SET loan_date = start_date WHERE loan_date IS NULL;
        END IF;
        UPDATE staff_loans SET loan_date = CURRENT_DATE WHERE loan_date IS NULL;
        ALTER TABLE staff_loans ALTER COLUMN loan_date SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_loans' AND column_name = 'start_deduction_month') THEN
        ALTER TABLE staff_loans ADD COLUMN start_deduction_month INTEGER;
        UPDATE staff_loans SET start_deduction_month = EXTRACT(MONTH FROM loan_date)::INTEGER WHERE start_deduction_month IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_loans' AND column_name = 'start_deduction_year') THEN
        ALTER TABLE staff_loans ADD COLUMN start_deduction_year INTEGER;
        UPDATE staff_loans SET start_deduction_year = EXTRACT(YEAR FROM loan_date)::INTEGER WHERE start_deduction_year IS NULL;
    END IF;

    -- Add pending_approval to status check if not already there
    -- Drop old constraint and recreate with all valid values
    ALTER TABLE staff_loans DROP CONSTRAINT IF EXISTS staff_loans_status_check;
    ALTER TABLE staff_loans ADD CONSTRAINT staff_loans_status_check
        CHECK (status IN ('active', 'paid', 'cancelled', 'pending_approval', 'completed', 'defaulted'));

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_loans' AND column_name = 'approved_by') THEN
        ALTER TABLE staff_loans ADD COLUMN approved_by UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_loans' AND column_name = 'branch_id') THEN
        ALTER TABLE staff_loans ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;
END $$;

-- Make old columns nullable so new inserts using only new column names work
DO $$
BEGIN
    ALTER TABLE staff_loans ALTER COLUMN monthly_installment DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE staff_loans ALTER COLUMN start_date DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
