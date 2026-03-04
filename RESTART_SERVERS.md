# Restart Servers

## Quick Restart

Double-click `restart-servers.bat` - it will:
1. Kill all Node processes
2. Start backend on port 5000
3. Start frontend on port 3001

## Manual Restart

### Step 1: Stop All Servers
Press `Ctrl+C` in both terminal windows (frontend and backend)

Or kill all Node processes:
```bash
taskkill /F /IM node.exe
```

### Step 2: Start Backend
```bash
cd backend
npm run dev
```

Should see:
```
Server running on port 5000
```

### Step 3: Start Frontend
```bash
cd frontend
npm run dev
```

Should see:
```
- Local: http://localhost:3001
```

## After Restart

1. Open http://localhost:3001
2. Login with:
   - Email: `admin@kyogongs.com`
   - Password: `Admin@123`
3. Go to `/dashboard/branch-accounting/record-banking`

## If Still Having Issues

1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+R)
3. Check browser console (F12) for errors
4. Make sure you ran the SQL from `CREATE_BANKING_TRANSACTIONS_TABLE.sql` in Supabase Dashboard
