# Petty Cash Feature - Manual Setup Instructions

## Quick Setup (5 minutes)

The petty cash request feature needs a database table to be created. Follow these simple steps:

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"

### Step 2: Copy and Run the SQL

Copy the ENTIRE SQL below and paste it into the SQL Editor, then click "Run":

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

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_petty_cash_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_petty_cash_updated_at
    BEFORE UPDATE ON petty_cash_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_petty_cash_updated_at();

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

### Step 3: Verify Success

After running the SQL, you should see a success message. The table is now created!

### Step 4: Test the Feature

1. Log in as a receptionist
2. Go to Reception Dashboard
3. Click the Wallet icon (Petty Cash button) in the top right
4. Fill in the form:
   - Amount: 5000
   - Category: Office Stationery
   - Description: Test request for office supplies
   - Date: Today
5. Click "Submit Request"
6. You should see: "Petty cash request submitted" ✅

## What This Feature Does

### For Receptionists:
- Submit petty cash requests for operational expenses
- Categories: Utilities, Maintenance, Food Supplies, Beverages, Transport, Kitchen Petty, Office Stationery, Cleaning Supplies, Other
- Track request status (pending, approved, rejected)
- View transaction history for their branch

### For Managers/Admins:
- View all petty cash requests
- Approve or reject requests
- Add approval notes
- Monitor spending by category
- Track who requested and who approved each transaction

## Troubleshooting

### If you see "Failed to submit request":
1. Make sure you ran the SQL in Step 2
2. Refresh your browser
3. Try submitting again

### If you see "Table already exists":
- That's fine! The table was already created
- Just proceed to Step 4 to test

### If you see permission errors:
- Make sure you're logged in as a receptionist or manager
- Check that your user has a branch_id assigned

## Need Help?

If you encounter any issues:
1. Check the browser console for error messages (F12 → Console tab)
2. Verify the table was created: Go to Supabase → Table Editor → Look for "petty_cash_transactions"
3. Make sure your user account has the correct role (receptionist, branch_manager, etc.)

---

**Status**: ⚠️ Requires manual SQL execution (5 minutes)

**Files Created**:
- ✅ Migration: `backend/supabase/migrations/38_petty_cash_transactions.sql`
- ✅ Controller: `backend/src/controllers/petty-cash.controller.ts`
- ✅ Routes: `backend/src/routes/petty-cash.routes.ts`
- ✅ Frontend Modal: `frontend/src/components/modals/PettyCashModal.tsx`
- ✅ API Integration: `frontend/src/lib/api.ts` (pettyCashAPI)

Once the SQL is run, the feature works immediately - no restart required!
