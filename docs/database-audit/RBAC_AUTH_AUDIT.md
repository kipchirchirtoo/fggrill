# RBAC And Auth Audit

Generated: 2026-06-14T16:30:53.317Z

## DATABASE_URL

- roles table: present
- permissions table: present
- user_branch_roles table: present
- role_permissions compatibility table: missing
- user_roles compatibility table: missing
- users columns inspected: id, email, first_name, last_name, role, avatar, department, phone_number, address, created_at, updated_at, last_login, password_changed_at, branch_id, pos_pin, pin_assigned_by, employee_id, shift, start_date, emergency_contact
- staff_profiles columns inspected: id, user_id, role, department, shift, basic_salary, start_date, id_number, emergency_contact, address, status, created_at, updated_at, branch_id, national_id, rfid_tag, rest_day, hourly_base_rate, kra_pin, nssf_number
- roles columns inspected: id, role_name, description, permissions, created_at, updated_at

## DATABASE_URL_NEW

- roles table: present
- permissions table: missing
- user_branch_roles table: present
- role_permissions compatibility table: missing
- user_roles compatibility table: missing
- users columns inspected: id, auth_user_id, email, password_hash, first_name, last_name, display_name, phone, status, default_branch_id, metadata, created_at, updated_at
- staff_profiles columns inspected: id, user_id, branch_id, department_id, employee_number, first_name, last_name, national_id, phone, email, job_title, employment_status, hire_date, metadata, created_at, updated_at
- roles columns inspected: id, code, name, scope, permissions, is_system, created_at, updated_at

## Backend Route Role Requirements

- accountant
- auditor
- branch_accountant
- branch_manager
- branch_storekeeper
- hr_manager
- receptionist
- super_admin


Important: `users` and `staff_profiles` are separate domains. Do not backfill missing staff rows by creating fake login users.
