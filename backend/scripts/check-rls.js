const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/Users/user/Desktop/fggrill/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
  const { data: policies, error } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT polname, polcmd, polroles, polqual, polwithcheck FROM pg_policy WHERE polrelid = 'public.dispatch_notes'::regclass"
  });
  
  if (error) {
     // If execute_sql not available, connect via pg directly
     const { Client } = require('pg');
     const client = new Client({ connectionString: process.env.DATABASE_URL });
     await client.connect();
     const res = await client.query("SELECT polname, polcmd, polroles, polqual, polwithcheck FROM pg_policy JOIN pg_class ON pg_class.oid = pg_policy.polrelid WHERE pg_class.relname = 'dispatch_notes'");
     console.log("Policies:", JSON.stringify(res.rows, null, 2));
     await client.end();
  } else {
    console.log("Policies:", JSON.stringify(policies, null, 2));
  }
}
checkRLS().catch(console.error);
