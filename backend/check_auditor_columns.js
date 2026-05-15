/**
 * Check if auditor columns exist in staff_advances table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkColumns() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Checking staff_advances table columns...\n');

    try {
        // Query to check column existence
        const { data, error } = await supabase
            .from('staff_advances')
            .select('id, accountant_confirmed_at, accountant_id, auditor_confirmed_at, auditor_id')
            .limit(1);

        if (error) {
            console.error('❌ Error querying staff_advances:', error.message);
            console.error('Error details:', error);
            process.exit(1);
        }

        console.log('✅ Query successful - columns exist!');
        console.log('📊 Sample data:', data);
        
    } catch (err) {
        console.error('❌ Check failed:', err.message);
        process.exit(1);
    }
}

checkColumns();
