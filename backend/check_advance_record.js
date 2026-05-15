/**
 * Check the specific advance record that's failing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkAdvance() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const advanceId = '32c0c4f4-c165-4caa-95ce-ad919b1b14e0';

    console.log(`🔍 Checking advance record: ${advanceId}\n`);

    try {
        const { data, error } = await supabase
            .from('staff_advances')
            .select('*')
            .eq('id', advanceId)
            .single();

        if (error) {
            console.error('❌ Error querying advance:', error.message);
            process.exit(1);
        }

        console.log('✅ Advance record found:');
        console.log(JSON.stringify(data, null, 2));
        
    } catch (err) {
        console.error('❌ Check failed:', err.message);
        process.exit(1);
    }
}

checkAdvance();
