/**
 * Check Reservations in Database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReservations() {
  console.log('🔍 Checking reservations in database...\n');

  // Fetch all reservations
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching reservations:', error.message);
    return;
  }

  if (!reservations || reservations.length === 0) {
    console.log('❌ No reservations found in database.');
    return;
  }

  console.log(`✓ Found ${reservations.length} reservation(s):\n`);
  
  reservations.forEach((res, index) => {
    console.log(`${index + 1}. ${res.confirmation_number}`);
    console.log(`   Guest: ${res.guest_name} (${res.guest_email})`);
    console.log(`   Created: ${new Date(res.created_at).toLocaleString()}`);
    console.log(`   Check-in: ${res.check_in_date}`);
    console.log(`   Total: KES ${res.total_amount}\n`);
  });
}

checkReservations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
