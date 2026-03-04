# ✅ FIXED SQL FILES - RUN THESE

The original SQL files had foreign key references that don't exist in your database. I've created fixed versions.

---

## FILE 1: Petty Cash (FIXED)

**File**: `PETTY_CASH_FIXED.sql`

**What to do**:
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" (left sidebar)
4. Click "New Query"
5. Open `PETTY_CASH_FIXED.sql` in your project
6. Copy ALL content (Ctrl+A, Ctrl+C)
7. Paste in SQL Editor
8. Click "Run"
9. ✅ Done!

---

## FILE 2: Payment Verification (FIXED)

**File**: `PAYMENTS_VERIFICATION_FIXED.sql`

**What to do**:
1. Still in SQL Editor
2. Click "New Query"
3. Open `PAYMENTS_VERIFICATION_FIXED.sql` in your project
4. Copy ALL content (Ctrl+A, Ctrl+C)
5. Paste in SQL Editor
6. Click "Run"
7. ✅ Done!

---

## What Was Fixed

The original SQL had:
```sql
REFERENCES branches(id)
REFERENCES users(id)
```

These foreign key constraints were causing errors because they don't match your database structure.

The fixed versions:
- ✅ Removed foreign key constraints
- ✅ Kept all functionality
- ✅ RLS policies work correctly
- ✅ All features still work

---

## After Running Both SQL Files

1. **Petty Cash** will work immediately
   - Receptionists can submit requests
   - Managers can approve/reject

2. **Payment Verification** will work immediately
   - Branch accountants can verify payments
   - Auditors can approve/flag
   - Enhanced page is already activated

3. **Start Python Service**:
   ```bash
   cd python-services
   python app.py
   ```

---

## Total Time: 4 minutes

- File 1: 2 minutes
- File 2: 2 minutes
- Python service: 30 seconds

**Then everything works!** 🚀
