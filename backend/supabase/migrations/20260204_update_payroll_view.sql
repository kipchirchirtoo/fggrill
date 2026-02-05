-- Migration to update payroll_records view with new enterprise fields

DROP VIEW IF EXISTS payroll_records;
CREATE OR REPLACE VIEW payroll_records AS
SELECT 
  id,
  staff_id,
  month,
  year,
  base_salary,
  overtime_hours,
  overtime_rate,
  bonuses,
  deductions,
  housing_levy_deduction,
  shif_deduction,
  nssf_deduction,
  absence_penalties,
  custom_deductions,
  custom_allowances,
  unpaid_leave_deduction,
  finance_transaction_id,
  net_salary,
  approval_status,
  status, -- maintaining backward compatibility
  notes,
  reviewed_by,
  reviewed_at,
  approved_by_id,
  approved_at,
  processed_by,
  processed_at,
  created_at,
  updated_at
FROM staff_payroll;

NOTIFY pgrst, 'reload schema';
