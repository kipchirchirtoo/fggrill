/**
 * Reset all rooms to available
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

async function resetRooms() {
    console.log("Resetting all rooms to 'available'...");
    const { data, error } = await supabase
        .from('rooms')
        .update({ status: 'available' })
        .neq('status', 'available');

    if (error) {
        console.error(`Error: ${error.message}`);
    } else {
        console.log("✅ All rooms reset to 'available'.");
    }
}

resetRooms();
