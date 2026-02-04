// Quick script to apply the trigger fix migration
require('dotenv').config();
const { Client } = require('pg');

const sql = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_first_name TEXT;
  meta_last_name TEXT;
BEGIN
  -- Extract names from raw_user_meta_data if available
  meta_first_name := COALESCE(new.raw_user_meta_data->>'first_name', 'User');
  meta_last_name := COALESCE(new.raw_user_meta_data->>'last_name', 'Account');

  -- Ensure minimum length of 2 characters to satisfy 'first_name_length' constraint
  IF char_length(meta_first_name) < 2 THEN
    meta_first_name := 'User';
  END IF;
  
  IF char_length(meta_last_name) < 2 THEN
    meta_last_name := 'Account';
  END IF;

  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    meta_first_name,
    meta_last_name,
    'guest'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function applyMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('Connecting to database...');
        await client.connect();

        console.log('Applying trigger fix migration...');
        await client.query(sql);

        console.log('✅ Migration applied successfully!');
        console.log('The handle_new_user trigger now uses proper default values (User/Account).');
        console.log('Empty strings will no longer be inserted, fixing the constraint violation.');
    } catch (err) {
        console.error('❌ Failed to apply migration:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
