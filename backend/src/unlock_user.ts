
import { supabase } from './config/supabase';

async function unlockUser(email: string) {
    try {
        console.log(`Unlocking user ${email}...`);
        const { data, error } = await supabase
            .from('users')
            .update({
                login_attempts: 0,
                lock_until: null
            })
            .eq('email', email)
            .select();

        if (error) {
            console.error('Error unlocking user:', error);
            return;
        }

        console.log('User unlocked successfully:', data);

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// Unlock the super admin
unlockUser('kipchirchirtoo01@gmail.com');
