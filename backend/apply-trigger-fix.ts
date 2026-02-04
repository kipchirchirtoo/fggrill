import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function applyMigration() {
    try {
        console.log('Applying trigger fix migration...');

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

        // Use the Supabase client to execute raw SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

        if (error) {
            console.error('❌ Error applying migration:', error);

            // Try alternative method using pg directly
            console.log('Trying alternative method...');
            const { Client } = require('pg');
            const client = new Client({
                connectionString: process.env.DATABASE_URL
            });

            await client.connect();
            await client.query(sql);
            await client.end();

            console.log('✅ Migration applied successfully via pg client!');
        } else {
            console.log('✅ Migration applied successfully!');
        }

        console.log('The handle_new_user trigger now uses proper default values.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to apply migration:', err);
        process.exit(1);
    }
}

applyMigration();
