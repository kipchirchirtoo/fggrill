
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('--- Verifying stock_counts enhanced schema ---');
    const { data, error } = await supabase
        .from('stock_counts')
        .select('id, status, verified_by, verified_at, audit_notes')
        .limit(1);

    if (error) {
        console.error('Error (Maybe columns missing?):', error.message);
    } else {
        console.log('Success! Columns are available.');
        console.log('Sample data:', data);
    }
}

verify().catch(console.error);
