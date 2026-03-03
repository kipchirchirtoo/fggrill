# Copy Existing Passwords from auth.users

## Problem
Users have passwords stored in `auth.users` table but the backend can't access them directly. We need to copy them to `users.password_hash` so the backend fallback authentication works.

## Solution

### Step 1: Run this SQL in Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/utsvlihpudfraxzcmtle/sql/new

Paste and run this SQL:

```sql
-- Create function to copy passwords
CREATE OR REPLACE FUNCTION copy_auth_passwords_to_users()
RETURNS TABLE (
  user_email TEXT,
  success BOOLEAN,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT 
      u.id,
      u.email,
      au.encrypted_password
    FROM public.users u
    INNER JOIN auth.users au ON u.id = au.id
    WHERE au.encrypted_password IS NOT NULL
  LOOP
    BEGIN
      UPDATE public.users
      SET 
        password_hash = user_record.encrypted_password,
        updated_at = NOW()
      WHERE id = user_record.id;
      
      RETURN QUERY SELECT 
        user_record.email::TEXT,
        TRUE,
        'Password copied'::TEXT;
        
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        user_record.email::TEXT,
        FALSE,
        SQLERRM::TEXT;
    END;
  END LOOP;
END;
$$;

-- Run the function to copy passwords
SELECT * FROM copy_auth_passwords_to_users();
```

### Step 2: Verify

After running the SQL, you should see output like:
```
user_email                    | success | message
------------------------------|---------|------------------
kipchirchirtoo01@gmail.com   | true    | Password copied
manager@kyogong.com        | true    | Password copied
...
```

### Step 3: Test Login

Now users can login with their EXISTING passwords!

The backend will:
1. Try Supabase Auth first
2. If that fails, check `password_hash` in `users` table
3. Compare the password and login

## Alternative: Run from Backend

```bash
cd backend
node run-copy-passwords.js
```

This will show you the SQL to run.

## What This Does

- Copies `encrypted_password` from `auth.users` to `password_hash` in `users` table
- Preserves existing passwords (no password reset needed!)
- Users can login with their current passwords
- Backend fallback authentication will work

## After This

✅ All users can login with their EXISTING passwords
✅ No need to reset passwords
✅ Backend authentication working
