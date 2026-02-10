
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectConstraints() {
    console.log('Inspecting constraints for hk_staff_profiles...');

    const { data, error } = await supabase
        .rpc('run_dynamic_query', {
            query: `
        SELECT
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.table_name = 'hk_staff_profiles'
        AND tc.constraint_type = 'FOREIGN KEY'
      `
        });

    if (error) {
        // If run_dynamic_query doesn't exist (it might not have been migrated), we'll try a direct select if permissions allow,
        // or we might need to rely on the error message.
        // However, usually we can't run raw SQL via the client unless we have a specific RPC function set up for it.
        console.error('RPC Error:', error);

        // Fallback: try to select from a known table to see if connection works
        const { data: testData, error: testError } = await supabase.from('hk_staff_profiles').select('id, user_id').limit(1);
        console.log('Test select:', testData, testError);
        return;
    }

    console.log('Constraints:', JSON.stringify(data, null, 2));
}

inspectConstraints();
