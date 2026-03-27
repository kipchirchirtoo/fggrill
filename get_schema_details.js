const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getTableSchema(tableName) {
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
    
    // If table is empty, we can try to get column info from information_schema if we have access via RPC or similar
    // For now, let's try a trick: insert a record and rollback? No, better use information_schema if possible.
    // Or just check if the model has some data in another branch?
    
    console.log(`--- Schema for ${tableName} ---`);
    if (error) {
        console.log(`Error: ${error.message}`);
    } else {
        // Since we can't get columns from empty data, we'll try to query information_schema.columns
        // PostgREST doesn't expose information_schema by default.
        // But maybe there's a file in the project that defines the schema?
    }
}

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Check if this exists
  if (error) {
    console.log('No get_tables rpc');
  } else {
    console.log('Tables:', data);
  }
}

// Let's try to find if there are any other tables by checking the existing JS files that do migrations/checks
// I'll check 'check_schema.js' and 'check_all_tables.js'

listTables();
getTableSchema('rooms');
getTableSchema('room_types');
getTableSchema('branches');
