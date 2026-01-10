const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBankTransactionSchema() {
    console.log('Checking accounting_bank_transactions schema...');
    // Since we can't query information_schema directly via JS client usually without RPC,
    // we'll try to insert a dummy record with 'created_by' and see the error,
    // OR we can try to select * limit 1 and look at keys if there's data.

    const { data, error } = await supabase
        .from('accounting_bank_transactions')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting from accounting_bank_transactions:', error);
    } else if (data && data.length > 0) {
        console.log('Columns found in first record:', Object.keys(data[0]));
    } else {
        console.log('No data found, cannot infer columns from select *');
    }

    // Also check if we can query pg_catalog or information_schema via rpc if available
    // But let's rely on the error message which says column not found.
    // We will assume it is missing.
}

checkBankTransactionSchema();
