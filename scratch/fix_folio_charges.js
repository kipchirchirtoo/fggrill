const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const resId = '06590ee6-2002-4378-b630-85d475e55366';
  const { data: folio } = await supabase.from('folios').select('*').eq('reservation_id', resId).single();
  const { data: reservation } = await supabase.from('reservations').select('*').eq('id', resId).single();
  
  console.log('Folio:', folio);
  console.log('Reservation:', reservation);
}

test();
