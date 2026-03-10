const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/Users/user/Desktop/fggrill/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('reservations').select('id, confirmation_number, room_id, guest_name').limit(2);
    if (error) console.error(error);
    console.log(JSON.stringify(data, null, 2));
}
check();
