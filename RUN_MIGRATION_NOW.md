# 🚀 Run Food Control Migration - Step by Step

## ⚠️ IMPORTANT: Manual Migration Required

The Supabase JavaScript client cannot execute DDL (Data Definition Language) statements directly. You need to run the migration SQL manually through the Supabase Dashboard.

---

## 📋 Method 1: Supabase Dashboard (RECOMMENDED - 2 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Login to your account
3. Select your project

### Step 2: Open SQL Editor
1. Click on **SQL Editor** in the left sidebar
2. Click **New Query** button

### Step 3: Copy Migration SQL
1. Open the file: `backend/src/database/migrations/20260425_food_control_system.sql`
2. Copy ALL the content (Ctrl+A, Ctrl+C)

### Step 4: Paste and Execute
1. Paste the SQL into the SQL Editor
2. Click **Run** button (or press Ctrl+Enter)
3. Wait for execution to complete (should take 5-10 seconds)

### Step 5: Verify Success
You should see:
- ✅ "Success. No rows returned"
- OR ✅ A list of created tables/indexes

---

## 📋 Method 2: psql Command Line (For Advanced Users)

### Prerequisites
- PostgreSQL client installed
- Database connection string from Supabase

### Steps
```bash
# Get your connection string from Supabase Dashboard → Settings → Database
# It looks like: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Run migration
psql "your_connection_string_here" < backend/src/database/migrations/20260425_food_control_system.sql
```

---

## 📋 Method 3: Supabase CLI (For Developers)

### Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login
```

### Steps
```bash
# Link your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

---

## ✅ Verification Checklist

After running the migration, verify these tables exist in Supabase Dashboard → Table Editor:

### New Tables (11)
- [ ] `buffets`
- [ ] `buffet_menu_items`
- [ ] `catering_events`
- [ ] `catering_menu_items`
- [ ] `catering_stock_allocations`
- [ ] `food_control_variance`
- [ ] `shift_financials`
- [ ] `stock_issues`
- [ ] `waste_logs`
- [ ] `recipe_change_log`
- [ ] `branch_food_control_config`

### Extended Tables (Check for new columns)
- [ ] `inventory_items` → has `cost_per_unit` column
- [ ] `restaurant_menu_items` → has `category` column
- [ ] `recipes` → has `is_locked`, `locked_by`, `locked_at` columns

### Functions (Check in Database → Functions)
- [ ] `generate_catering_event_number()`
- [ ] `update_buffet_updated_at()`
- [ ] `update_catering_event_updated_at()`

### Triggers (Check in Database → Triggers)
- [ ] `trigger_gen_catering_event_number` on `catering_events`
- [ ] `trigger_update_buffet_updated_at` on `buffets`
- [ ] `trigger_update_catering_event_updated_at` on `catering_events`

---

## 🐛 Troubleshooting

### Error: "relation already exists"
**Solution**: Some tables may already exist. This is OK - the migration uses `IF NOT EXISTS` clauses.

### Error: "column already exists"
**Solution**: Some columns may already exist. This is OK - the migration uses `ADD COLUMN IF NOT EXISTS`.

### Error: "permission denied"
**Solution**: Make sure you're using the service_role key, not the anon key.

### Error: "syntax error"
**Solution**: Make sure you copied the ENTIRE SQL file, including all functions and triggers.

---

## 📊 Post-Migration Steps

### 1. Verify Tables Created
```sql
-- Run this in SQL Editor to see all new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'buffets', 'buffet_menu_items', 'catering_events', 
  'catering_menu_items', 'catering_stock_allocations',
  'food_control_variance', 'shift_financials', 'stock_issues',
  'waste_logs', 'recipe_change_log', 'branch_food_control_config'
)
ORDER BY table_name;
```

### 2. Check Row Counts
```sql
-- Should show 0 rows for new tables (except branch_food_control_config)
SELECT 
  'buffets' as table_name, COUNT(*) as row_count FROM buffets
UNION ALL
SELECT 'catering_events', COUNT(*) FROM catering_events
UNION ALL
SELECT 'branch_food_control_config', COUNT(*) FROM branch_food_control_config;
```

### 3. Verify Branch Configs Created
```sql
-- Should show one row per branch
SELECT * FROM branch_food_control_config;
```

### 4. Test a Simple Insert
```sql
-- Test creating a buffet (should work)
INSERT INTO buffets (name, buffet_type, price_per_person, expected_guests, branch_id)
VALUES ('Test Buffet', 'lunch', 1500.00, 50, 1)
RETURNING *;

-- Clean up test data
DELETE FROM buffets WHERE name = 'Test Buffet';
```

---

## 🎉 Success!

If all verification steps pass, your migration is complete! 

### Next Steps:
1. ✅ Start backend server: `npm run dev` (in backend folder)
2. ✅ Start frontend server: `npm run dev` (in frontend folder)
3. ✅ Test the new features:
   - Navigate to `/dashboard/branch-accounting/buffet`
   - Create a test buffet event
   - Navigate to `/dashboard/branch-accounting/catering`
   - Create a test catering event
4. ✅ Configure branch settings:
   - Navigate to `/dashboard/admin/settings/food-control`
   - Set thresholds for your branch

---

## 📞 Need Help?

If you encounter any issues:

1. **Check Supabase Logs**: Dashboard → Logs → Database
2. **Review Error Messages**: Copy the exact error message
3. **Check SQL Syntax**: Make sure entire file was copied
4. **Verify Permissions**: Use service_role key, not anon key

---

## 📝 Migration SQL Location

The migration SQL file is located at:
```
backend/src/database/migrations/20260425_food_control_system.sql
```

File size: ~16.5 KB  
Statements: 52 SQL statements  
Estimated execution time: 5-10 seconds

---

**Ready to run the migration? Follow Method 1 above! 🚀**
