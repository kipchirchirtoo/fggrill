
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function diagnose() {
    console.log('Starting diagnosis (JS)...');

    const url = process.env.SUPABASE_PROJECT_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('Missing Supabase credentials');
        process.exit(1);
    }

    const supabase = createClient(url, key);

    // 1. Check if table exists
    try {
        const { data, error } = await supabase
            .from('wastage_records')
            .select('count', { count: 'exact', head: true });

        if (error) {
            console.error('Error checking table existence:', error);
        } else {
            console.log('Table "wastage_records" exists. Count:', data);
        }
    } catch (e) {
        console.error('Exception checking table:', e);
    }

    // 2. Check simple select
    try {
        const { data, error } = await supabase
            .from('wastage_records')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error with simple select:', error);
        } else {
            console.log('Simple select success. Rows:', data?.length);
        }
    } catch (e) {
        console.error('Exception with simple select:', e);
    }

    // 3. Check relation join
    try {
        console.log('Testing relation join...');
        const { data, error } = await supabase
            .from('wastage_records')
            .select(`
        *,
        user:users!logged_by(id, first_name, last_name, email)
      `)
            .limit(1);

        if (error) {
            console.error('Error with join select:', JSON.stringify(error, null, 2));
        } else {
            console.log('Join select success. Rows:', data?.length);
        }
    } catch (e) {
        console.error('Exception with join select:', e);
    }

    console.log('Diagnosis complete.');
}

diagnose();
