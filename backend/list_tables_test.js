const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Attempt RPC if common
  if (error) {
    // If RPC fails, try generic query
    const { data: tables, error: tableError } = await supabase
      .from('pg_catalog.pg_tables') // Usually not directly accessible without service role or specific permissions
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (tableError) {
      console.error('Error listing tables:', tableError.message);
      // Try listing from staff_profiles relationship columns if any
      return;
    }
    console.log(tables.map(t => t.tablename));
  } else {
    console.log(data);
  }
}

async function listTablesRaw() {
  // Since we have the postgres URL in .env, let's use pg client
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log(res.rows.map(r => r.table_name).join(', '));
  await client.end();
}

listTablesRaw();
