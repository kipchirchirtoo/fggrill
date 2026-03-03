-- Create a function to copy passwords from auth.users to users.password_hash
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
  updated_count INTEGER := 0;
BEGIN
  -- Loop through all users that have passwords in auth.users
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
      -- Update the user's password_hash
      UPDATE public.users
      SET 
        password_hash = user_record.encrypted_password,
        updated_at = NOW()
      WHERE id = user_record.id;
      
      updated_count := updated_count + 1;
      
      RETURN QUERY SELECT 
        user_record.email::TEXT,
        TRUE,
        'Password copied successfully'::TEXT;
        
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        user_record.email::TEXT,
        FALSE,
        SQLERRM::TEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION copy_auth_passwords_to_users() TO authenticated;
GRANT EXECUTE ON FUNCTION copy_auth_passwords_to_users() TO service_role;
