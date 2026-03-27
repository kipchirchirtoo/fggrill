const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function listAllTables() {
    const { data: tables, error: tablesError } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');

    if (tablesError) {
        // Alternative way if pg_tables is not directly accessible via PostgREST
        const { data: schemaData, error: schemaError } = await supabase
            .rpc('get_tables'); // Checking if a helper RPC exists

        if (schemaError) {
            console.log('Error fetching tables via rpc:', schemaError);
            
            // Try querying information_schema.tables directly if possible
            // Usually PostgREST doesn't allow direct access to information_schema unless exposed
            console.log('Trying direct query on a known table to get a sense of schema...');
        } else {
            console.log('Tables:', schemaData);
        }
    } else {
        console.log('Tables:', tables.map(t => t.tablename));
    }

    // Let's try to fetch from some likely tables
    const likelyTables = ['branches', 'rooms', 'room_types', 'room_rates', 'conference_halls', 'facilities', 'services'];
    for (const table of likelyTables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table ${table} error:`, error.message);
        } else {
            console.log(`Table ${table} exists and has ${data.length} sample row(s)`);
            if (data.length > 0) {
                console.log(`Sample row from ${table}:`, Object.keys(data[0]));
            }
        }
    }
}

listAllTables();
