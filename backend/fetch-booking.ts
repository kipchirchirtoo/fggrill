import { supabase } from './src/config/supabase';

async function main() {
    const { data, error } = await supabase
        .from('reservations')
        .select('id')
        .limit(1)
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Booking ID:', data.id);
    }
}

main();
