
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
    console.log('--- Checking stock_counts constraints ---');
    // Use run_dynamic_query if available or just a direct query via RPC if allowed?
    // Since I don't know if RPC is there, I'll try to trigger a constraint error and see the name.
    // Actually, I can use information_schema.

    const { data, error } = await supabase.rpc('run_dynamic_query', {
        query: "SELECT conname FROM pg_constraint WHERE conrelid = 'stock_counts'::regclass"
    });

    if (error) {
        console.error('Error:', error);
        // Fallback: search via schema items if rpc not allowed
    } else {
        console.log('Constraints:', data);
    }
}

checkConstraints().catch(console.error);
