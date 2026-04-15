
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugProfiles() {
    console.log('--- All Users ---');
    const { data: users } = await supabase.from('users').select('id, email, first_name, last_name, role');
    console.log(users);

    console.log('--- All Staff Profiles ---');
    const { data: staff } = await supabase.from('staff_profiles').select('id, user_id');
    console.log(staff);
}

debugProfiles().catch(console.error);
