
import { supabase } from './config/supabase';

async function listAuthUsers() {
    try {
        console.log('Listing auth users...');
        const { data, error } = await supabase.auth.admin.listUsers();

        if (error) {
            console.error('Error listing auth users:', error);
            return;
        }

        console.log('Auth users found:', data.users.length);
        data.users.forEach(u => {
            console.log(`ID: ${u.id}, Email: ${u.email}`);
        });

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

listAuthUsers();
