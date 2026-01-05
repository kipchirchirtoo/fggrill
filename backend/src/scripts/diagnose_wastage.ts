
import 'dotenv/config';
import { supabase } from '../config/supabase';

async function diagnose() {
    console.log('Starting diagnosis...');

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
            if (data && data.length > 0) console.log('Sample row:', data[0]);
        }
    } catch (e) {
        console.error('Exception with simple select:', e);
    }

    // 3. Check relation join
    try {
        const { data, error } = await supabase
            .from('wastage_records')
            .select(`
        *,
        user:users!logged_by(id, first_name, last_name, email)
      `)
            .limit(1);

        if (error) {
            console.error('Error with join select:', error);
        } else {
            console.log('Join select success. Rows:', data?.length);
        }
    } catch (e) {
        console.error('Exception with join select:', e);
    }

    process.exit(0);
}

diagnose();
