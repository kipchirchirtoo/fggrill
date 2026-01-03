import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './src/config/database';

async function inspectReservations() {
    const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Reservations sample:', Object.keys(data?.[0] || {}));
    }
}

inspectReservations();
