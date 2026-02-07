
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDetails() {
    console.log('--- stock_movements details ---');
    const { data, error } = await supabase.rpc('run_dynamic_query', {
        query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_movements'"
    });
    if (error) console.error('Columns Error:', error);
    else console.log('Columns:', data);

    const { data: constraints, error: cError } = await supabase.rpc('run_dynamic_query', {
        query: "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'stock_movements'::regclass"
    });
    if (cError) console.error('Constraints Error:', cError);
    else console.log('Constraints:', constraints);
}

checkDetails().catch(console.error);
