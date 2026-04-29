# Director Dashboard - Complete Fix Guide

## Problem Summary
The director dashboard was showing "Access Denied" (403 errors) because:
1. Users don't have the `director` role assigned in the database
2. Required database tables may not exist
3. No sample data exists to display

## ✅ What Was Fixed

### 1. Backend Controllers
- **Updated all director controllers** to handle missing tables gracefully
- Added proper error handling with fallback empty data
- Improved error messages to help diagnose issues
- Controllers now return success with empty data instead of failing

**Files Modified:**
- `backend/src/controllers/director.controller.ts`
- `backend/src/controllers/discrepancies.controller.ts`

### 2. Frontend Pages
- **Added proper error handling** with user-friendly messages
- **Added loading states** for better UX
- **Added empty state displays** when no data exists
- **Improved error messages** to guide users on fixing access issues

**Files Modified:**
- `frontend/src/app/dashboard/director/page.tsx`
- `frontend/src/app/dashboard/director/banking/page.tsx`
- `frontend/src/app/dashboard/director/discrepancies/page.tsx`
- `frontend/src/app/dashboard/director/payments/page.tsx` (created)
- `frontend/src/app/dashboard/director/drill-down/page.tsx`

### 3. Helper Scripts
Created utility scripts to help diagnose and fix issues:
- `backend/fix-director-role.js` - Assigns director role to a user
- `backend/test-director-auth.js` - Diagnoses auth and database issues

## 🚀 How to Fix Access Denied Errors

### Step 1: Assign Director Role to Your User

Run this command to give yourself director access:

```bash
node backend/fix-director-role.js your-email@example.com
```

Example:
```bash
node backend/fix-director-role.js admin@famousgate.com
```

### Step 2: Log Out and Log Back In

After assigning the role:
1. Log out of the application
2. Log back in with the same account
3. Navigate to `/dashboard/director`

### Step 3: Verify Database Tables Exist

Run the diagnostic script:

```bash
node backend/test-director-auth.js
```

This will check:
- ✅ Users with director role
- ✅ `daily_financial_records` table exists
- ✅ `discrepancy_flags` table exists
- ✅ `branches` table exists
- ✅ Sample data availability

### Step 4: Run Missing Migrations (if needed)

If tables are missing, run these migrations:

```bash
# Financial workspace tables
psql -d your_database -f backend/supabase/migrations/72_financial_workspace_tables.sql

# Discrepancy system
psql -d your_database -f backend/supabase/migrations/73_discrepancy_system.sql
```

Or use Supabase CLI:
```bash
supabase db push
```

## 📊 Director Dashboard Features

### 1. **Main Dashboard** (`/dashboard/director`)
- Global financial overview across all branches
- Total revenue, expenses, net profit, profit margin
- Revenue & profit trend charts
- Branch performance comparison

### 2. **Payment Intelligence** (`/dashboard/director/payments`)
- Payment method breakdown (M-PESA, Cash, Card)
- Payment distribution pie chart
- Payment comparison bar chart
- Date range filtering

### 3. **Banking Control** (`/dashboard/director/banking`)
- Cash collected vs banked per branch
- Variance tracking and flagging
- Branch-by-branch reconciliation
- High-variance alerts

### 4. **Discrepancy Control** (`/dashboard/director/discrepancies`)
- Audit flag management
- Discrepancy workflow (Pending → Under Review → Resolved)
- Severity levels (Low, Medium, High, Critical)
- Accountant response tracking
- Director final decision workflow

### 5. **Deep Drill-Down** (`/dashboard/director/drill-down`)
- Company → Branch → Date → Stream navigation
- Real branch data from API
- Transaction-level exploration (coming soon)

## 🔧 Troubleshooting

### Issue: Still Getting 403 Errors

**Check 1: Verify Role in Database**
```sql
SELECT id, email, role, first_name, last_name 
FROM users 
WHERE email = 'your-email@example.com';
```

The `role` column should show `director`.

**Check 2: Clear Browser Cache**
- Clear cookies and local storage
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

**Check 3: Check JWT Token**
- Open browser DevTools → Network tab
- Look at API requests to `/api/finance/director/*`
- Verify `Authorization: Bearer <token>` header exists

**Check 4: Backend Logs**
Check backend console for RBAC messages:
```
[RBAC Check] URL: /api/finance/director/overview, User Role: "director", Allowed: [super_admin, director, general_manager]
```

### Issue: No Data Showing

This is normal if:
1. No financial records have been entered yet
2. Date range doesn't match existing data
3. Tables exist but are empty

**Solution:** The dashboard will show zeros and empty charts until data is entered through the financial workspace.

### Issue: Tables Don't Exist

Run migrations:
```bash
cd backend
npm run migrate
```

Or manually:
```bash
psql -d your_database -f backend/supabase/migrations/72_financial_workspace_tables.sql
psql -d your_database -f backend/supabase/migrations/73_discrepancy_system.sql
```

## 📝 Adding Sample Data (Optional)

To test the dashboard with sample data:

```sql
-- Insert sample financial record
INSERT INTO daily_financial_records (
  branch_id,
  record_date,
  total_revenue,
  total_expenses,
  net_profit,
  payment_data,
  status
) VALUES (
  1, -- your branch ID
  CURRENT_DATE,
  150000,
  80000,
  70000,
  '{"mpesa": 90000, "cash": 40000, "card": 20000}'::jsonb,
  'SUBMITTED'
);

-- Insert sample discrepancy flag
INSERT INTO discrepancy_flags (
  branch_id,
  record_date,
  flag_type,
  severity,
  description,
  status
) VALUES (
  1,
  CURRENT_DATE,
  'CASH_VARIANCE',
  'MEDIUM',
  'Unbanked cash variance detected: KES 5,000',
  'PENDING'
);
```

## 🎯 Next Steps

1. **Assign director role** to your user account
2. **Run diagnostic script** to verify setup
3. **Log in and test** the director dashboard
4. **Add financial data** through the financial workspace
5. **Monitor discrepancies** and banking control

## 📞 Support

If you still have issues:
1. Check backend logs for detailed error messages
2. Run `node backend/test-director-auth.js` for diagnostics
3. Verify all migrations have been applied
4. Ensure your user has `role='director'` in the database

---

**All director dashboard pages now have:**
- ✅ Real API integration (no mock data)
- ✅ Proper error handling
- ✅ Loading states
- ✅ Empty state displays
- ✅ User-friendly error messages
- ✅ Graceful fallbacks when data is missing
