-- ============================================================
-- API SCHEMA ALIGNMENT - 2026-06-14
-- Fixes all visible backend API errors
-- ============================================================

-- 1. cashier_shifts: backend expects start_time/end_time
ALTER TABLE public.cashier_shifts
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cashier_name TEXT;

UPDATE public.cashier_shifts SET start_time = opened_at WHERE start_time IS NULL AND opened_at IS NOT NULL;
UPDATE public.cashier_shifts SET end_time = closed_at WHERE end_time IS NULL AND closed_at IS NOT NULL;

-- 2. staff_credit_bills: backend expects bill_date
ALTER TABLE public.staff_credit_bills ADD COLUMN IF NOT EXISTS bill_date DATE DEFAULT CURRENT_DATE;
UPDATE public.staff_credit_bills SET bill_date = created_at::date WHERE bill_date IS NULL;

-- 3. staff_profiles: backend expects status column
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
UPDATE public.staff_profiles SET status = employment_status WHERE status = 'active' AND employment_status IS NOT NULL;

-- 4. payment_verifications: backend expects recorded_at
ALTER TABLE public.payment_verifications ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();
UPDATE public.payment_verifications SET recorded_at = created_at WHERE recorded_at IS NULL;

-- 5. accounting_customers: backend expects customer_name
ALTER TABLE public.accounting_customers ADD COLUMN IF NOT EXISTS customer_name TEXT;
UPDATE public.accounting_customers SET customer_name = name WHERE customer_name IS NULL;

-- 6. payroll_batches: backend expects batch_number
ALTER TABLE public.payroll_batches ADD COLUMN IF NOT EXISTS batch_number TEXT;
UPDATE public.payroll_batches SET batch_number = batch_name WHERE batch_number IS NULL;

-- 7. restaurant_orders: backend expects department
ALTER TABLE public.restaurant_orders ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'restaurant';

-- 8. unpaid_bills: backend expects waiter_id and customer_id
ALTER TABLE public.unpaid_bills ADD COLUMN IF NOT EXISTS waiter_id UUID;
ALTER TABLE public.unpaid_bills ADD COLUMN IF NOT EXISTS customer_id UUID;

-- 9. Create department_accounts table
CREATE TABLE IF NOT EXISTS public.department_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
    department_id UUID,
    department_name TEXT NOT NULL,
    account_code TEXT,
    budget_amount NUMERIC(15,2) DEFAULT 0,
    spent_amount NUMERIC(15,2) DEFAULT 0,
    remaining_amount NUMERIC(15,2) DEFAULT 0,
    fiscal_year INTEGER,
    fiscal_month INTEGER,
    status TEXT DEFAULT 'active',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Add reservation_id to payments if both tables exist
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reservation_id UUID;

-- 11. stock_takes: add common missing columns
ALTER TABLE public.stock_takes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.stock_takes ADD COLUMN IF NOT EXISTS variance_value NUMERIC(15,2) DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_start_time ON public.cashier_shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_bill_date ON public.staff_credit_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON public.staff_profiles(status);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_recorded_at ON public.payment_verifications(recorded_at);
CREATE INDEX IF NOT EXISTS idx_department_accounts_branch ON public.department_accounts(branch_id);
