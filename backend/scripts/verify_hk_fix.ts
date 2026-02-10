
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyHKTasksQuery() {
    console.log('Testing hk_tasks join with hk_staff_profiles and users...');

    // This is the problematic query from tasks.controller.ts
    const { data, error } = await supabase
        .from('hk_tasks')
        .select(`
      id,
      assignee:hk_staff_profiles!assigned_to(
        id, staff_code,
        user:users!user_id(first_name, last_name)
      ),
      completed_by_staff:hk_staff_profiles!completed_by(
        id, staff_code,
        user:users!user_id(first_name, last_name)
      )
    `)
        .limit(1);

    if (error) {
        console.error('FAILED:', error);
        process.exit(1);
    }

    console.log('SUCCESS! Query executed without error.');
    console.log('Sample data:', JSON.stringify(data, null, 2));
}

verifyHKTasksQuery();
