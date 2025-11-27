# Database Migration Instructions

## Migration File Location
`/home/john/fggrill/backend/migrations/20251125_create_core_org_tables.sql`

## How to Apply Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. **Login to Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select your project: `utsvlihpudfraxzcmtle`

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration**
   - Open the file: `/home/john/fggrill/backend/migrations/20251125_create_core_org_tables.sql`
   - Copy all contents
   - Paste into the SQL Editor

4. **Run Migration**
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for completion
   - Check for any errors in the output

5. **Verify Tables Created**
   - Click "Table Editor" in the left sidebar
   - You should see the new tables:
     - `roles`
     - `permissions`
     - `branches`
     - `departments`
     - `staff_attendance`
     - `vehicles`
     - `vehicle_assignments`
     - `budgets`
     - `expenses`
     - `audit_logs`

### Option 2: Via psql Command Line

```bash
# Set environment variables
export PGHOST=aws-0-eu-west-1.pooler.supabase.com
export PGPORT=5432
export PGUSER=postgres.utsvlihpudfraxzcmtle
export PGPASSWORD='Allan@13900'
export PGDATABASE=postgres

# Run migration
psql -f /home/john/fggrill/backend/migrations/20251125_create_core_org_tables.sql
```

### Option 3: Via Supabase CLI

```bash
cd /home/john/fggrill/backend
supabase db push
```

## What Will Be Created

### 1. Roles & Permissions
- **roles** table - User role definitions
- **permissions** table - Module-level permissions (create, read, update, delete, approve)

### 2. Organization Structure
- **branches** table - Hotel branches with locations
- **departments** table - Departments per branch with budgets

### 3. HR & Attendance
- **staff_attendance** table - Daily attendance tracking (clock in/out, status, overtime)

### 4. Fleet Management
- **vehicles** table - Hotel vehicles (trucks, vans, cars)
- **vehicle_assignments** table - Vehicle assignments to drivers/transfers

### 5. Finance
- **budgets** table - Budget allocation by branch/department/category/year
- **expenses** table - Operational expenses with approval workflow

### 6. Audit & Compliance
- **audit_logs** table - Comprehensive activity audit trail

## Post-Migration Steps

### 1. Verify Tables
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'roles', 'permissions', 'branches', 'departments', 
  'staff_attendance', 'vehicles', 'vehicle_assignments',
  'budgets', 'expenses', 'audit_logs'
)
ORDER BY table_name;
```

### 2. Seed Initial Data (Optional)

```sql
-- Seed default branches
INSERT INTO branches (name, code, location, phone, email, is_main_branch, status) VALUES
('Famous Gate Kericho', 'KER-01', 'Kericho Town', '0790900777', 'kericho@famousgate.co.ke', true, 'active'),
('Famous Gate Nakuru', 'NAK-01', 'Nakuru Town', '0790900778', 'nakuru@famousgate.co.ke', false, 'active');

-- Seed default departments (already in migration)
-- store_departments table already has default departments

-- Seed default roles (if needed)
INSERT INTO roles (role_name, description) VALUES
('super_admin', 'Full system access'),
('manager', 'Management and operational access'),
('accountant', 'Finance and reporting access'),
('storekeeper', 'Inventory and requisition access'),
('receptionist', 'Booking and guest management');
```

### 3. Test API Endpoints

Once migration is complete, test the new endpoints:

```bash
# Get branches
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/system/branches

# Get departments
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/system/departments

# Get vehicles
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/fleet/vehicles

# Get budgets
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/finance/budgets

# Get expenses
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/finance/expenses

# Get audit logs
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/audit/logs

# Get attendance
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/staff/attendance
```

## Troubleshooting

### Error: "relation already exists"
- **Cause:** Table already exists
- **Solution:** Either drop the table first or modify the migration to use `CREATE TABLE IF NOT EXISTS`

### Error: "permission denied"
- **Cause:** User doesn't have CREATE TABLE permissions
- **Solution:** Use service role key or admin account

### Error: "foreign key constraint fails"
- **Cause:** Referenced table doesn't exist yet
- **Solution:** Ensure all dependencies are created first (e.g., `users` table must exist)

## Rollback (if needed)

If you need to undo the migration:

```sql
-- Drop tables in reverse order (to handle foreign keys)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS vehicle_assignments CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS staff_attendance CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
```

## Next Steps After Migration

1. ✅ **Backend**: Restart backend server to load new routes
2. ✅ **Frontend**: All UI pages are already created and ready
3. ✅ **Test**: Access the new pages in the dashboard
4. ✅ **Seed**: Add initial data for your hotel

## Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify database connection credentials
3. Ensure backend server is running
4. Check browser console for frontend errors

---

**Migration Status**: Ready to apply  
**Backend Status**: Controllers and routes implemented  
**Frontend Status**: UI pages implemented  
**Dependencies**: None (all existing tables are already present)
