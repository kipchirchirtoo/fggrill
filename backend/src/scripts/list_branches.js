
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching Branches...');
    // Try 'branches' table first
    let { data, error } = await supabase.from('branches').select('*');

    if (error) {
        console.log('Error fetching branches:', error.message);
        // Try 'departments' or 'locations'?
        const { data: d2, error: e2 } = await supabase.from('departments').select('*');
        if (d2) {
            console.log('Departments found:', d2);
        }
    } else {
        console.log('Branches found:', data);
    }
}

run();
