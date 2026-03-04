# Quick Login Fix

You're stuck on the login page. Here's how to fix it:

## Step 1: Create Banking Transactions Table

The app is likely failing because the `banking_transactions` table doesn't exist yet.

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `CREATE_BANKING_TRANSACTIONS_TABLE.sql`
4. Click "Run"

## Step 2: Login Credentials

Use these credentials to login:

**Super Admin:**
- Email: `admin@kyogongs.com`
- Password: `Admin@123`

**Branch Accountant (if you have one):**
- Check your users table for branch_accountant role users

## Step 3: If Still Stuck

If you're still stuck after creating the table:

1. Open browser console (F12)
2. Check for any errors
3. Clear browser cache and cookies
4. Try logging in again

## Step 4: Check Backend

Make sure backend is running:
```bash
cd backend
npm run dev
```

Should be running on http://localhost:5000

## Common Issues

1. **Table doesn't exist**: Run the SQL from `CREATE_BANKING_TRANSACTIONS_TABLE.sql`
2. **Backend not running**: Start backend with `npm run dev` in backend folder
3. **Wrong credentials**: Use admin@kyogongs.com / Admin@123
4. **Browser cache**: Clear cache and hard refresh (Ctrl+Shift+R)

## After Login

Once logged in as branch accountant:
1. Go to `/dashboard/branch-accounting/record-banking`
2. You'll see two tabs: "Record Transaction" and "Transaction History"
3. Record a banking transaction
4. View it in the history tab with status
