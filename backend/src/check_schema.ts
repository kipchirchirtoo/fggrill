
import { supabase } from './config/supabase';

async function checkUsersTable() {
    try {
        console.log('Checking users table schema...');

        // Try to select the new columns
        const { data, error } = await supabase
            .from('users')
            .select('id, login_attempts, lock_until')
            .limit(1);

        if (error) {
            console.error('Error selecting new columns:', error);
        } else {
            console.log('Successfully selected new columns:', data);
        }

        // Check activity_logs table
        console.log('Checking activity_logs table...');
        const { data: logs, error: logsError } = await supabase
            .from('activity_logs')
            .select('*')
            .limit(1);

        if (logsError) {
            console.error('Error selecting from activity_logs:', logsError);
        } else {
            console.log('Successfully selected from activity_logs:', logs);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkUsersTable();
