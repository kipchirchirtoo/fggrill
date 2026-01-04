
import { supabase } from './config/supabase';

async function verifyAuthUser(userId: string) {
    try {
        console.log(`Verifying auth user ${userId}...`);
        const { data, error } = await supabase.auth.admin.getUserById(userId);

        if (error) {
            console.error('Error fetching auth user:', error);
            return;
        }

        console.log('Auth user found:', data.user);
        console.log('Confirmed At:', data.user?.confirmed_at);
        console.log('Last Sign In:', data.user?.last_sign_in_at);
        // console.log('Banned:', data.user?.banned_until);

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// Verify the super admin
verifyAuthUser('8f969365-e8fb-42b3-a0ab-d18e73e47091');
