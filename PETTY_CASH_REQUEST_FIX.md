# Petty Cash Request Fix - Receptionist Module

## Problem
Petty cash requests in the receptionist module dashboard were failing with "Failed to submit request" error.

## Root Cause
The `petty_cash_transactions` table does not exist in the database. The frontend and backend code are correctly implemented, but the database table was never created.

## Solution
Created migration file `backend/supabase/migrations/38_petty_cash_transactions.sql` to create the required table with proper structure, indexes, and Row Level Security policies.

## Table Structure
```sql
CREATE TABLE petty_cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Manual Fix Required

Since automated migration execution is not available, you need to manually run the migration:

### Steps:
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Open the file: `backend/supabase/migrations/38_petty_cash_transactions.sql`
4. Copy the entire SQL content
5. Paste it into the Supabase SQL Editor
6. Click "Run" to execute the migration

### Quick SQL (if you prefer to copy directly):
```sql
-- Create petty_cash_transactions table
CREATE TABLE IF NOT EXISTS petty_cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_petty_cash_branch ON petty_cash_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_status ON petty_cash_transactions(status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON petty_cash_transactions(date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_requested_by ON petty_cash_transactions(requested_by);
CREATE INDEX IF NOT EXISTS idx_petty_cash_approved_by ON petty_cash_transactions(approved_by);

-- Enable RLS
ALTER TABLE petty_cash_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view petty cash from their branch"
    ON petty_cash_transactions FOR SELECT
    USING (
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'auditor'))
    );

CREATE POLICY "Receptionists can create petty cash requests"
    ON petty_cash_transactions FOR INSERT
    WITH CHECK (
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('receptionist', 'branch_manager', 'super_admin', 'general_manager'))
    );

CREATE POLICY "Managers can update petty cash status"
    ON petty_cash_transactions FOR UPDATE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'branch_manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'branch_manager')));

CREATE POLICY "Admins can delete petty cash transactions"
    ON petty_cash_transactions FOR DELETE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager')));

-- Grant permissions
GRANT ALL ON petty_cash_transactions TO authenticated;
GRANT ALL ON petty_cash_transactions TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

## Features Included

### For Receptionists:
- Submit petty cash requests with:
  - Amount
  - Category (Utilities, Maintenance, Food Supplies, etc.)
  - Description/Purpose
  - Date
- View their branch's petty cash transactions
- Track request status (pending, approved, rejected)

### For Managers/Admins:
- View all petty cash requests
- Approve or reject requests
- Add approval notes
- Track who requested and who approved

### Security:
- Row Level Security (RLS) enabled
- Users can only see transactions from their branch
- Only authorized roles can approve/reject
- Audit trail with timestamps and user tracking

## API Endpoints
- `GET /api/petty-cash` - Get petty cash transactions (filtered by branch)
- `POST /api/petty-cash` - Submit new petty cash request
- `PATCH /api/petty-cash/:id/status` - Approve/reject request (managers only)

## Files Created/Modified
- ✅ `backend/supabase/migrations/38_petty_cash_transactions.sql` - Database migration
- ✅ `backend/src/controllers/petty-cash.controller.ts` - Already exists
- ✅ `backend/src/routes/petty-cash.routes.ts` - Already exists
- ✅ `frontend/src/components/modals/PettyCashModal.tsx` - Already exists
- ✅ `frontend/src/lib/api.ts` - pettyCashAPI already exists

## Testing After Migration
1. Run the migration in Supabase SQL Editor
2. Log in as a receptionist
3. Go to Reception Dashboard
4. Click the Wallet icon (Petty Cash button)
5. Fill in the form:
   - Amount: 5000
   - Category: Office Stationery
   - Description: Test request
   - Date: Today
6. Click "Submit Request"
7. Should see success message: "Petty cash request submitted"

## Status
⚠️ REQUIRES MANUAL ACTION - SQL must be executed in Supabase Dashboard

**Quick Fix (5 minutes):**
1. Open Supabase Dashboard → SQL Editor
2. Copy SQL from `PETTY_CASH_MANUAL_SETUP.md` 
3. Paste and click "Run"
4. Feature works immediately!

See `PETTY_CASH_MANUAL_SETUP.md` for detailed step-by-step instructions.

Once the migration is run, the petty cash request feature will work immediately - no restart required!
