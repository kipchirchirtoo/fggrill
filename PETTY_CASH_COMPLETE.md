# ✅ Petty Cash Feature - Ready to Deploy

## Current Status
All code is complete and ready. Only the database table needs to be created.

## What's Already Done ✅
- ✅ Backend controller: `backend/src/controllers/petty-cash.controller.ts`
- ✅ Backend routes: `backend/src/routes/petty-cash.routes.ts`
- ✅ Frontend modal: `frontend/src/components/modals/PettyCashModal.tsx`
- ✅ API integration: `frontend/src/lib/api.ts` (pettyCashAPI)
- ✅ Migration file: `backend/supabase/migrations/38_petty_cash_transactions.sql`
- ✅ SQL ready to run: `PETTY_CASH_SQL_TO_RUN.sql`

## Final Step Required (2 minutes)

Since Supabase doesn't allow SQL execution via API (security feature), you need to run the SQL manually:

### Option 1: Copy from File
1. Open `PETTY_CASH_SQL_TO_RUN.sql` in this project
2. Copy ALL the content (Ctrl+A, Ctrl+C)
3. Go to Supabase Dashboard → SQL Editor
4. Paste and click "Run"
5. Done! ✅

### Option 2: Copy from Below
Copy this entire SQL block and run it in Supabase SQL Editor:

```sql
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

CREATE INDEX IF NOT EXISTS idx_petty_cash_branch ON petty_cash_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_status ON petty_cash_transactions(status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON petty_cash_transactions(date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_requested_by ON petty_cash_transactions(requested_by);
CREATE INDEX IF NOT EXISTS idx_petty_cash_approved_by ON petty_cash_transactions(approved_by);

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

ALTER TABLE petty_cash_transactions ENABLE ROW LEVEL SECURITY;

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

GRANT ALL ON petty_cash_transactions TO authenticated;
GRANT ALL ON petty_cash_transactions TO service_role;

NOTIFY pgrst, 'reload schema';
```

## After Running SQL

The feature works immediately! Test it:

1. Log in as receptionist
2. Go to Reception Dashboard
3. Click Wallet icon (top right)
4. Fill form and submit
5. Should see: "Petty cash request submitted" ✅

## Why Manual SQL?

Supabase doesn't expose SQL execution via REST API for security reasons. This is standard practice - DDL operations (CREATE TABLE, etc.) must be run through the dashboard to prevent unauthorized schema changes.

## Summary

Everything is coded and ready. Just run the SQL once in Supabase Dashboard and the feature is live!

**Time Required**: 2 minutes
**Difficulty**: Copy & Paste
**Impact**: Full petty cash request system for all branches
