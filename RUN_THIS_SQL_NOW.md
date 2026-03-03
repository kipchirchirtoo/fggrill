# 🔐 FIX ALL USER PASSWORDS - RUN THIS SQL NOW

## ⚠️ THE ISSUE
Passwords ARE hashed and stored in `auth.users` table, but backend needs them in `users.password_hash` field.

## ✅ THE FIX (30 SECONDS)

### 1. Open Supabase SQL Editor
- Go to: https://supabase.com/dashboard/project/utsvlihpudfraxzcmtle/sql
- Or: Dashboard → SQL Editor → New Query

### 2. Copy & Paste This SQL:

```sql
UPDATE public.users u
SET password_hash = au.encrypted_password,
    updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id 
  AND au.encrypted_password IS NOT NULL;
```

### 3. Click "RUN" Button

### 4. You Should See:
```
UPDATE 50
```
(or however many users you have)

## ✅ DONE!

Now ALL users can login with their EXISTING passwords:
- `kipchirchirtoo01@gmail.com` with password `Allan@13900`
- All other users with THEIR passwords

## 🔧 Backend Already Ready
The backend code is already set up to authenticate from `users.password_hash` field.

## 📁 Files:
- `backend/COPY_PASSWORDS.sql` - The SQL query
- `FIX_ALL_USER_PASSWORDS_NOW.md` - Detailed instructions
- This file - Quick instructions

## ⚡ Why SQL Editor?
The Supabase API cannot access `auth.users.encrypted_password` field for security reasons. 
You MUST run the SQL directly in Supabase SQL Editor.
