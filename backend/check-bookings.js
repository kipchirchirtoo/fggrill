/**
 * Check Bookings in Database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBookings() {
  console.log('🔍 Checking bookings in database...\n');

  // Fetch all bookings
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching bookings:', error.message);
    return;
  }

  if (!bookings || bookings.length === 0) {
    console.log('❌ No bookings found in database.');
    return;
  }

  console.log(`✓ Found ${bookings.length} booking(s):\n`);
  
  bookings.forEach((booking, index) => {
    console.log(`${index + 1}. ${booking.confirmation_number}`);
    console.log(`   Guest: ${booking.guest_name} (${booking.guest_email})`);
    console.log(`   Created: ${new Date(booking.created_at).toLocaleString()}`);
    console.log(`   Check-in: ${booking.check_in_date}`);
    console.log(`   Total: KES ${booking.total_amount}\n`);
  });
}

checkBookings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
