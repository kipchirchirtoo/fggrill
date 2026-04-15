import * as dotenv from 'dotenv';
dotenv.config();
import { supabase } from './src/config/database';
import db from './src/db';

async function check() {
    const { data: room } = await supabase.from('rooms').select('id, room_number, status').eq('room_number', '123').single();
    if (!room) {
        console.log('Room 123 not found');
        return;
    }
    console.log('Room 123 Status:', room.status);

    const { data: res } = await supabase.from('reservations').select('id, check_in_date, check_out_date, status, guests(first_name, last_name)').eq('room_id', room.id);
    console.log('Reservations for Room 123:');
    if (res) {
        res.forEach((r: any) => {
            console.log(`- Guest: ${r.guests.first_name} ${r.guests.last_name}, Dates: ${r.check_in_date} to ${r.check_out_date}, Status: ${r.status}`);
        });
    }

    while (!db.isAvailable()) await new Promise(r => setTimeout(r, 500));
    const history = await db.query('SELECT * FROM room_status_history WHERE room_id = $1 ORDER BY created_at DESC LIMIT 10', [room.id]);
    console.log('History for Room 123:');
    history.rows.forEach(h => {
        console.log(`- ${h.previous_status} -> ${h.new_status} at ${h.created_at}: ${h.notes}`);
    });
    process.exit();
}

check();
