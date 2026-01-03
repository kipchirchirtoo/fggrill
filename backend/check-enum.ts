import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from './src/config/database';

async function checkEnum() {
    console.log('Checking room status enum...');
    // Try to update a room to a non-existent status to get the list of valid values from the error message
    const { error } = await supabase
        .from('rooms')
        .update({ status: 'invalid_status_test' })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .limit(1);

    if (error) {
        console.log('Error message (should contain valid values):', error.message);
    } else {
        console.log('Update unexpectedly succeeded!');
    }
}

checkEnum();
