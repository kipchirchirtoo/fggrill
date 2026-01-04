
import { supabase } from './config/supabase';

async function forceUpdatePassword() {
    const email = 'kipchirchirtoo01@gmail.com';
    const password = 'Allan@13900';

    console.log(`Force updating password for ${email}...`);

    try {
        // Get user ID first from public table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            console.error('Could not find user in public.users table:', userError);
            return;
        }

        const userId = userData.id;
        console.log(`Found user ID: ${userId}`);

        // Update password using Admin API
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
            userId,
            { password: password }
        );

        if (updateError) {
            console.error('Failed to update password:', updateError);
        } else {
            console.log('Password successfully updated to user provided value.');

            // Also unlock the account
            await supabase
                .from('users')
                .update({
                    login_attempts: 0,
                    lock_until: null
                })
                .eq('id', userId);

            console.log('Account unlocked.');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

forceUpdatePassword();
