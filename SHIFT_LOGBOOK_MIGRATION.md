# Shift Logbook Migration Instructions

## Option 1: Run via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `backend/supabase/migrations/29_cashier_shift_logs.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute the migration

## Option 2: Run via Supabase CLI

If you have Supabase CLI configured and linked:

```bash
cd backend
npx supabase db push
```

If you get "Cannot find project ref" error, link your project first:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

## Option 3: Manual Execution via psql

If you have direct database access:

```bash
psql -h YOUR_DB_HOST -U postgres -d postgres -f backend/supabase/migrations/29_cashier_shift_logs.sql
```

## What This Migration Creates

- ✅ `cashier_shift_logs` table - Main shift tracking
- ✅ `cashier_shift_transactions` table - Transaction links
- ✅ `shift_status` enum type
- ✅ `generate_shift_number()` function
- ✅ `calculate_shift_summary()` function
- ✅ Row-level security policies
- ✅ Indexes for performance

## Verification

After running the migration, verify it worked by running:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('cashier_shift_logs', 'cashier_shift_transactions');
```

You should see both tables listed.

## Migration File Location

[`backend/supabase/migrations/29_cashier_shift_logs.sql`](file:///c:/Users/user/Desktop/fggrill/backend/supabase/migrations/29_cashier_shift_logs.sql)
