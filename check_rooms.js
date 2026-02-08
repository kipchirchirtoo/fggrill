/**
 * Check room statuses
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkRooms() {
    const { data: occupiedRooms, count: occupiedCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact' })
        .eq('status', 'occupied');

    const { count: totalRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true });

    console.log(`Total Rooms: ${totalRooms}`);
    console.log(`Occupied Rooms: ${occupiedCount}`);
    if (totalRooms > 0) {
        console.log(`Calculated Occupancy: ${Math.round((occupiedCount || 0) / totalRooms * 100)}%`);
    }
}

checkRooms();
