require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    let query = supabase
      .from('staff_profiles')
      .select('*, user:users!user_id(*)', { count: 'exact' });
      
    const { data, count, error } = await query;
    console.log("Count from original query:", count);
    console.log("Data length from original query:", data ? data.length : 0);
    if (error) console.error(error);
}
run();
