
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStaff() {
    console.log('--- Checking staff_profiles relationship ---');
    const { data, error } = await supabase
        .from('staff_profiles')
        .select('id, user_id')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Data:', data);
    }
}

checkStaff().catch(console.error);
