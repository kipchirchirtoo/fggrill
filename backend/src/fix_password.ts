
import { supabase } from './config/supabase';

async function checkAndFixPassword() {
    const email = 'kipchirchirtoo01@gmail.com';
    const password = 'Allan@13900';

    console.log(`Checking login for ${email} with provided password...`);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.log('Login failed:', error.message);

        if (error.message === 'Invalid login credentials') {
            console.log('Password mismatch. Updating password to user provided value...');

            // Get user ID first
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

                // Also unlock the account just in case
                await supabase
                    .from('users')
                    .update({
                        login_attempts: 0,
                        lock_until: null
                    })
                    .eq('id', userId);

                console.log('Account unlocked.');
            }
        }
    } else {
        console.log('Login successful! Password is correct.');
        // Ensure account is unlocked
        await supabase
            .from('users')
            .update({
                login_attempts: 0,
                lock_until: null
            })
            .eq('id', data.user.id);
        console.log('Account unlocked.');
    }
}

checkAndFixPassword();
