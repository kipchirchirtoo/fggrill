
import { supabase } from './config/supabase';

async function checkUsers() {
    try {
        console.log('Fetching users...');
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, password, role, login_attempts, lock_until');

        if (error) {
            console.error('Error fetching users:', error);
            return;
        }

        console.log('Users found:', users.length);
        users.forEach(user => {
            console.log('--------------------------------');
            console.log(`ID: ${user.id}`);
            console.log(`Email: ${user.email}`);
            console.log(`Password: ${user.password ? 'EXISTS' : 'NULL'}`);
            console.log(`Role: ${user.role}`);
            console.log(`Login Attempts: ${user.login_attempts}`);
            console.log(`Lock Until: ${user.lock_until}`);
            // console.log(`Status: ${user.status}`);
        });

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkUsers();
