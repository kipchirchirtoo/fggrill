-- Auditor + HR compatibility layer for the clean database.
-- This migration is deliberately additive/idempotent:
-- - keep public.users (login/RBAC) separate from public.staff_profiles (HR records)
-- - bridge legacy backend expectations with canonical clean-db tables
-- - do not create duplicate write paths for canonical procurement/inventory tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.fg_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- RBAC/auth compatibility
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  module text,
  action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  role text,
  permission text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id),
  UNIQUE (role, permission)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  role text,
  branch_id integer REFERENCES public.branches(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, branch_id),
  UNIQUE (user_id, role, branch_id)
);

ALTER TABLE public.user_branch_roles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean;
UPDATE public.users
SET is_active = COALESCE(is_active, status IS NULL OR lower(status) IN ('active', 'enabled'))
WHERE is_active IS NULL;

CREATE OR REPLACE FUNCTION public.sync_user_active_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_active IS NULL THEN
    NEW.is_active := COALESCE(NEW.status IS NULL OR lower(NEW.status) IN ('active', 'enabled'), true);
  END IF;
  IF NEW.status IS NULL THEN
    NEW.status := CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_active_status ON public.users;
CREATE TRIGGER trg_sync_user_active_status
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_active_status();

CREATE OR REPLACE VIEW public.user_branch_roles_view AS
SELECT
  ubr.id,
  ubr.user_id,
  ubr.branch_id,
  ubr.role_id,
  COALESCE(r.name, u.role) AS role,
  ubr.is_active,
  ubr.created_at,
  u.email,
  u.first_name,
  u.last_name,
  u.display_name,
  b.name AS branch_name,
  b.code AS branch_code
FROM public.user_branch_roles ubr
LEFT JOIN public.users u ON u.id = ubr.user_id
LEFT JOIN public.roles r ON r.id = ubr.role_id
LEFT JOIN public.branches b ON b.id = ubr.branch_id;

-- ---------------------------------------------------------------------------
-- HR/staff compatibility
-- ---------------------------------------------------------------------------

ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS employment_status text;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS id_number text;
UPDATE public.staff_profiles
SET
  employment_status = COALESCE(employment_status, status),
  id_number = COALESCE(id_number, national_id)
WHERE employment_status IS NULL OR id_number IS NULL;

CREATE OR REPLACE FUNCTION public.sync_staff_profile_aliases()
RETURNS trigger AS $$
BEGIN
  IF NEW.employment_status IS NULL THEN
    NEW.employment_status := COALESCE(NEW.status, 'active');
  END IF;
  IF NEW.status IS NULL THEN
    NEW.status := COALESCE(NEW.employment_status, 'active');
  END IF;
  IF NEW.id_number IS NULL THEN
    NEW.id_number := NEW.national_id;
  END IF;
  IF NEW.national_id IS NULL THEN
    NEW.national_id := NEW.id_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_staff_profile_aliases ON public.staff_profiles;
CREATE TRIGGER trg_sync_staff_profile_aliases
BEFORE INSERT OR UPDATE ON public.staff_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_staff_profile_aliases();

ALTER TABLE public.staff_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.staff_documents ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.staff_documents ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE public.staff_documents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.staff_documents SET file_path = COALESCE(file_path, file_url) WHERE file_path IS NULL;

ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS in_method text;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS out_method text;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS is_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS hours_normal numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS hours_ot_weekday numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS hours_ot_rest numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS hours_ot_holiday numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS hours_night numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS clock_in_lateness_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.staff_leave ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.staff_leave ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.staff_leave ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_leave ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.staff_leave ADD COLUMN IF NOT EXISTS actual_return_date date;
ALTER TABLE public.staff_leave ADD COLUMN IF NOT EXISTS reported_at timestamptz;
ALTER TABLE public.staff_leave ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_leave ADD COLUMN IF NOT EXISTS report_notes text;

ALTER TABLE public.staff_performance ADD COLUMN IF NOT EXISTS review_period_month integer;
ALTER TABLE public.staff_performance ADD COLUMN IF NOT EXISTS review_period_year integer;
ALTER TABLE public.staff_performance ADD COLUMN IF NOT EXISTS attendance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_performance ADD COLUMN IF NOT EXISTS punctuality numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_performance ADD COLUMN IF NOT EXISTS teamwork numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_performance ADD COLUMN IF NOT EXISTS customer_service numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_performance ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.staff_performance
SET
  review_period_month = COALESCE(review_period_month, EXTRACT(MONTH FROM review_date)::integer),
  review_period_year = COALESCE(review_period_year, EXTRACT(YEAR FROM review_date)::integer)
WHERE review_date IS NOT NULL AND (review_period_month IS NULL OR review_period_year IS NULL);

CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  branch_id integer REFERENCES public.branches(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  review_period_month integer,
  review_period_year integer,
  attendance_score numeric NOT NULL DEFAULT 0,
  punctuality_score numeric NOT NULL DEFAULT 0,
  task_completion_score numeric NOT NULL DEFAULT 0,
  customer_service_score numeric NOT NULL DEFAULT 0,
  overall_score numeric NOT NULL DEFAULT 0,
  rating text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS base_salary numeric;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS allowances numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS nssf_deduction numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS shif_deduction numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS tax_deductions numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS housing_levy_deduction numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS net_salary numeric;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.payroll
SET base_salary = COALESCE(base_salary, basic_salary),
    net_salary = COALESCE(net_salary, net_pay)
WHERE base_salary IS NULL OR net_salary IS NULL;

ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS base_salary numeric;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS net_salary numeric;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS overtime_hours numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS overtime_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS overtime_pay numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS bonuses numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS deductions numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS total_additions numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS additions jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS deductions_detail jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.payroll_records
SET base_salary = COALESCE(base_salary, basic_salary),
    net_salary = COALESCE(net_salary, net_pay)
WHERE base_salary IS NULL OR net_salary IS NULL;

ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS base_salary numeric;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS net_salary numeric;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS nssf_deduction numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS shif_deduction numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS tax_deductions numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS housing_levy_deduction numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS overtime_hours numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS overtime_pay numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS bonuses numeric NOT NULL DEFAULT 0;
ALTER TABLE public.staff_payroll ADD COLUMN IF NOT EXISTS deductions numeric NOT NULL DEFAULT 0;
UPDATE public.staff_payroll
SET base_salary = COALESCE(base_salary, basic_salary),
    net_salary = COALESCE(net_salary, net_pay),
    nssf_deduction = COALESCE(NULLIF(nssf_deduction, 0), nssf, 0),
    shif_deduction = COALESCE(NULLIF(shif_deduction, 0), shif, 0),
    tax_deductions = COALESCE(NULLIF(tax_deductions, 0), paye, 0),
    housing_levy_deduction = COALESCE(NULLIF(housing_levy_deduction, 0), housing_levy, 0),
    deductions = COALESCE(NULLIF(deductions, 0), total_deductions, 0)
WHERE base_salary IS NULL OR net_salary IS NULL;

ALTER TABLE public.staff_advances ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.staff_advances ADD COLUMN IF NOT EXISTS month_to_deduct integer;
ALTER TABLE public.staff_advances ADD COLUMN IF NOT EXISTS year_to_deduct integer;
ALTER TABLE public.staff_advances ADD COLUMN IF NOT EXISTS accountant_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_advances ADD COLUMN IF NOT EXISTS accountant_confirmed_at timestamptz;
ALTER TABLE public.staff_advances ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_advances ADD COLUMN IF NOT EXISTS auditor_confirmed_at timestamptz;
ALTER TABLE public.staff_advances ADD COLUMN IF NOT EXISTS deducted_in_payroll_id uuid;
UPDATE public.staff_advances
SET reason = COALESCE(reason, purpose),
    month_to_deduct = COALESCE(month_to_deduct, EXTRACT(MONTH FROM repayment_date)::integer),
    year_to_deduct = COALESCE(year_to_deduct, EXTRACT(YEAR FROM repayment_date)::integer)
WHERE reason IS NULL OR month_to_deduct IS NULL OR year_to_deduct IS NULL;

ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS total_amount numeric;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS installment_amount numeric;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS remaining_balance numeric;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS loan_date date;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS start_deduction_month integer;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS start_deduction_year integer;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS accountant_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS accountant_confirmed_at timestamptz;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS auditor_confirmed_at timestamptz;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS payment_history jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.staff_loans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.staff_loans
SET total_amount = COALESCE(total_amount, loan_amount),
    installment_amount = COALESCE(installment_amount, monthly_deduction),
    remaining_balance = COALESCE(remaining_balance, balance),
    loan_date = COALESCE(loan_date, start_date),
    start_deduction_month = COALESCE(start_deduction_month, EXTRACT(MONTH FROM start_date)::integer),
    start_deduction_year = COALESCE(start_deduction_year, EXTRACT(YEAR FROM start_date)::integer)
WHERE total_amount IS NULL OR installment_amount IS NULL OR remaining_balance IS NULL OR loan_date IS NULL;

-- ---------------------------------------------------------------------------
-- Auditor tables, review columns, and finance verification
-- ---------------------------------------------------------------------------

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS public.audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer REFERENCES public.branches(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  request_type text NOT NULL,
  entity_type text,
  entity_id text,
  title text,
  description text,
  amount numeric,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer REFERENCES public.branches(id) ON DELETE CASCADE,
  approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  entity_type text,
  entity_id text,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS audit_date date;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS performed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS total_revenue numeric NOT NULL DEFAULT 0;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS total_payments numeric NOT NULL DEFAULT 0;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS occupancy_percentage numeric NOT NULL DEFAULT 0;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS adr numeric NOT NULL DEFAULT 0;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS revpar numeric NOT NULL DEFAULT 0;
ALTER TABLE public.audit_night_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.audit_night_sessions
SET audit_date = COALESCE(audit_date, session_date),
    started_at = COALESCE(started_at, created_at),
    performed_by = COALESCE(performed_by, auditor_id)
WHERE audit_date IS NULL OR started_at IS NULL OR performed_by IS NULL;

ALTER TABLE public.audit_exceptions ADD COLUMN IF NOT EXISTS audit_session_id uuid REFERENCES public.audit_night_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.audit_exceptions ADD COLUMN IF NOT EXISTS amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.audit_exceptions ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE public.audit_exceptions ADD COLUMN IF NOT EXISTS reference_id text;
ALTER TABLE public.audit_exceptions ADD COLUMN IF NOT EXISTS raised_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_exceptions ADD COLUMN IF NOT EXISTS detected_at timestamptz;
ALTER TABLE public.audit_exceptions ADD COLUMN IF NOT EXISTS resolution_notes text;
UPDATE public.audit_exceptions
SET detected_at = COALESCE(detected_at, created_at),
    raised_by = COALESCE(raised_by, created_by)
WHERE detected_at IS NULL OR raised_by IS NULL;

ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS audit_name text;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS objectives text;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.audit_plans
SET audit_name = COALESCE(audit_name, title),
    auditor_id = COALESCE(auditor_id, created_by)
WHERE audit_name IS NULL OR auditor_id IS NULL;

ALTER TABLE public.audit_findings ADD COLUMN IF NOT EXISTS audit_plan_id uuid REFERENCES public.audit_plans(id) ON DELETE SET NULL;
ALTER TABLE public.audit_findings ADD COLUMN IF NOT EXISTS finding_number text;
ALTER TABLE public.audit_findings ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.audit_findings ADD COLUMN IF NOT EXISTS evidence text;
ALTER TABLE public.audit_findings ADD COLUMN IF NOT EXISTS recommendation text;
ALTER TABLE public.audit_findings ADD COLUMN IF NOT EXISTS responsible_person text;
ALTER TABLE public.audit_findings ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.audit_findings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.audit_findings
SET finding_number = COALESCE(finding_number, 'F-' || substr(id::text, 1, 8)),
    category = COALESCE(category, finding_type)
WHERE finding_number IS NULL OR category IS NULL;

ALTER TABLE public.audit_config_consumption ADD COLUMN IF NOT EXISTS menu_item_id uuid;
ALTER TABLE public.audit_config_consumption ADD COLUMN IF NOT EXISTS inventory_item_sku text;
ALTER TABLE public.audit_config_consumption ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1;
ALTER TABLE public.audit_config_consumption ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_config_consumption_unique_mapping
ON public.audit_config_consumption (menu_item_id, inventory_item_sku, branch_id)
WHERE menu_item_id IS NOT NULL AND inventory_item_sku IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer REFERENCES public.branches(id) ON DELETE CASCADE,
  expense_number text UNIQUE,
  category text,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_orders ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.restaurant_orders ADD COLUMN IF NOT EXISTS audited_at timestamptz;
ALTER TABLE public.restaurant_orders ADD COLUMN IF NOT EXISTS audit_notes text;

ALTER TABLE public.bar_orders ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.bar_orders ADD COLUMN IF NOT EXISTS audited_at timestamptz;
ALTER TABLE public.bar_orders ADD COLUMN IF NOT EXISTS audit_notes text;

ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS audited_at timestamptz;
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS audit_notes text;

ALTER TABLE public.accounting_ar_invoices ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.accounting_ar_invoices ADD COLUMN IF NOT EXISTS audited_at timestamptz;
ALTER TABLE public.accounting_ar_invoices ADD COLUMN IF NOT EXISTS audit_notes text;
ALTER TABLE public.accounting_ar_invoices ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;
ALTER TABLE public.accounting_ar_invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.unpaid_bills ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.unpaid_bills ADD COLUMN IF NOT EXISTS auditor_confirmed_at timestamptz;
ALTER TABLE public.unpaid_bills ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.unpaid_bills ADD COLUMN IF NOT EXISTS balance_amount numeric;
ALTER TABLE public.unpaid_bills ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.unpaid_bills ADD COLUMN IF NOT EXISTS bill_date date;
UPDATE public.unpaid_bills
SET balance_amount = COALESCE(balance_amount, balance_due),
    customer_name = COALESCE(customer_name, guest_name),
    bill_date = COALESCE(bill_date, created_at::date)
WHERE balance_amount IS NULL OR customer_name IS NULL OR bill_date IS NULL;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_id uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_date timestamptz;
UPDATE public.payments SET payment_date = COALESCE(payment_date, recorded_at, created_at) WHERE payment_date IS NULL;

-- ---------------------------------------------------------------------------
-- Procurement/inventory compatibility used by auditor/director services
-- ---------------------------------------------------------------------------

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS vendor_id uuid;
UPDATE public.purchase_orders SET vendor_id = COALESCE(vendor_id, supplier_id) WHERE vendor_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_purchase_order_vendor_supplier()
RETURNS trigger AS $$
BEGIN
  IF NEW.vendor_id IS NULL THEN
    NEW.vendor_id := NEW.supplier_id;
  END IF;
  IF NEW.supplier_id IS NULL THEN
    NEW.supplier_id := NEW.vendor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_purchase_order_vendor_supplier ON public.purchase_orders;
CREATE TRIGGER trg_sync_purchase_order_vendor_supplier
BEFORE INSERT OR UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_purchase_order_vendor_supplier();

CREATE OR REPLACE VIEW public.purchase_order_items AS
SELECT
  l.id,
  l.purchase_order_id,
  l.purchase_order_id AS po_id,
  l.item_id,
  l.sku AS item_sku,
  l.item_name,
  l.quantity_ordered AS quantity,
  l.quantity_ordered,
  l.quantity_ordered AS ordered_quantity,
  l.quantity_received,
  l.quantity_received AS received_quantity,
  l.quantity_pending,
  l.unit,
  l.unit AS unit_of_measure,
  l.unit_price,
  l.unit_price AS unit_cost,
  l.line_total,
  l.line_total AS total_cost,
  l.created_at,
  l.updated_at
FROM public.purchase_order_lines l;

CREATE OR REPLACE VIEW public.stock_movements AS
SELECT
  im.id,
  im.branch_id,
  ii.sku AS item_sku,
  im.item_id,
  im.movement_type,
  im.quantity,
  COALESCE(im.document_number, im.movement_number) AS reference_number,
  im.reason AS notes,
  im.actor_id AS created_by,
  im.created_at
FROM public.inventory_movements im
LEFT JOIN public.inventory_items ii ON ii.id = im.item_id
UNION ALL
SELECT
  bsm.id,
  bsm.branch_id,
  bsm.item_sku,
  bsm.item_id,
  bsm.movement_type,
  bsm.quantity,
  bsm.reference_number,
  bsm.notes,
  bsm.created_by,
  bsm.created_at
FROM public.branch_stock_movements bsm;

-- stock_requests and stock_request_items are compatibility views in the clean DB.
-- Extend those views with legacy aliases rather than mutating the canonical tables twice.
CREATE OR REPLACE VIEW public.stock_requests AS
SELECT
  id,
  branch_id,
  request_number,
  requested_by,
  status,
  priority,
  reason,
  requested_at,
  auditor_id,
  auditor_decided_at,
  metadata,
  created_at,
  updated_at,
  request_type,
  workflow_status,
  submitted_to_auditor_at,
  document_number,
  reviewed_by,
  reviewed_at,
  review_notes,
  needed_by_date,
  requesting_branch_id,
  barcode_value,
  auditor_decision_at,
  sent_to_central_store_at,
  requested_by AS created_by,
  reviewed_by AS approved_by,
  reviewed_at AS approved_at
FROM public.branch_requisitions;

CREATE OR REPLACE VIEW public.stock_request_items AS
SELECT
  id,
  branch_requisition_id,
  item_id,
  requested_quantity,
  approved_quantity,
  packed_quantity,
  received_quantity,
  unit,
  line_status,
  reason,
  created_at,
  item_sku,
  current_branch_stock,
  workflow_status,
  request_id,
  status,
  unavailable_quantity,
  rejection_reason,
  requested_quantity AS quantity_requested,
  requested_quantity AS quantity,
  approved_quantity AS quantity_approved
FROM public.branch_requisition_lines;

ALTER TABLE public.branch_stock_movements ADD COLUMN IF NOT EXISTS auditor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.branch_stock_movements ADD COLUMN IF NOT EXISTS audited_at timestamptz;
ALTER TABLE public.branch_stock_movements ADD COLUMN IF NOT EXISTS audit_notes text;

ALTER TABLE public.stock_counts ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.stock_counts ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.stock_counts ADD COLUMN IF NOT EXISTS audit_notes text;

ALTER TABLE public.restaurant_bar_inventory ADD COLUMN IF NOT EXISTS current_bottles numeric;
ALTER TABLE public.restaurant_bar_inventory ADD COLUMN IF NOT EXISTS last_counted_at timestamptz;
UPDATE public.restaurant_bar_inventory
SET current_bottles = COALESCE(current_bottles, current_stock),
    last_counted_at = COALESCE(last_counted_at, updated_at, created_at)
WHERE current_bottles IS NULL OR last_counted_at IS NULL;

ALTER TABLE public.bar_stock_requests ADD COLUMN IF NOT EXISTS bar_branch_id integer REFERENCES public.branches(id) ON DELETE SET NULL;
UPDATE public.bar_stock_requests SET bar_branch_id = COALESCE(bar_branch_id, branch_id) WHERE bar_branch_id IS NULL;

-- ---------------------------------------------------------------------------
-- Indexes, triggers, RLS/grants
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_permissions_module_action ON public.permissions(module, action);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_branch ON public.user_roles(user_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_employment_status ON public.staff_profiles(employment_status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_branch_date ON public.staff_attendance(branch_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_leave_branch_status ON public.staff_leave(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_performance_period ON public.staff_performance(branch_id, review_period_year, review_period_month);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_staff_period ON public.performance_reviews(staff_id, review_period_year, review_period_month);
CREATE INDEX IF NOT EXISTS idx_audit_trail_branch_performed ON public.audit_trail(branch_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON public.audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_branch_status ON public.approval_requests(branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_approvals_branch_created ON public.audit_approvals(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_exceptions_branch_status ON public.audit_exceptions(branch_id, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_night_sessions_branch_date ON public.audit_night_sessions(branch_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_status ON public.expenses(branch_id, status, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_branch_status ON public.unpaid_bills(branch_id, status, bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);

DROP TRIGGER IF EXISTS trg_touch_staff_documents ON public.staff_documents;
CREATE TRIGGER trg_touch_staff_documents
BEFORE UPDATE ON public.staff_documents
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_staff_attendance ON public.staff_attendance;
CREATE TRIGGER trg_touch_staff_attendance
BEFORE UPDATE ON public.staff_attendance
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_performance_reviews ON public.performance_reviews;
CREATE TRIGGER trg_touch_performance_reviews
BEFORE UPDATE ON public.performance_reviews
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_approval_requests ON public.approval_requests;
CREATE TRIGGER trg_touch_approval_requests
BEFORE UPDATE ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_expenses ON public.expenses;
CREATE TRIGGER trg_touch_expenses
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.permissions,
  public.role_permissions,
  public.user_roles,
  public.performance_reviews,
  public.audit_trail,
  public.approval_requests,
  public.audit_approvals,
  public.expenses
TO authenticated, service_role;

GRANT SELECT ON
  public.user_branch_roles_view,
  public.purchase_order_items,
  public.stock_movements
TO authenticated, service_role;
