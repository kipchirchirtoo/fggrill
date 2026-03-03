const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixHotelDetails() {
  console.log('🏨 Checking and fixing hotel details...\n');

  try {
    // Check current hotel details
    const { data: hotelDetails, error: fetchError } = await supabase
      .from('hotel_details')
      .select('*')
      .limit(1)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching hotel details:', fetchError);
      return;
    }

    if (!hotelDetails) {
      console.log('⚠️  No hotel details found in database');
      return;
    }

    console.log('📋 Current Hotel Details:\n');
    console.log(`   Name: ${hotelDetails.name}`);
    console.log(`   Email: ${hotelDetails.email || 'N/A'}`);
    console.log(`   Phone: ${hotelDetails.phone || 'N/A'}`);
    console.log(`   Address: ${hotelDetails.address || 'N/A'}`);
    console.log('');

    // Check if it's set to "Kyogong" (wrong)
    if (hotelDetails.name === 'Kyogong') {
      console.log('⚠️  Hotel name is incorrectly set to "Kyogong"');
      console.log('✅ Fixing to "Famous Gates Hotels"...\n');

      const { data: updated, error: updateError } = await supabase
        .from('hotel_details')
        .update({ 
          name: 'Famous Gates Hotels',
          updated_at: new Date().toISOString()
        })
        .eq('id', hotelDetails.id)
        .select();

      if (updateError) {
        console.error('❌ Error updating hotel details:', updateError);
      } else {
        console.log('✅ Successfully updated hotel name to "Famous Gates Hotels"');
        console.log('\n📋 Updated Hotel Details:\n');
        console.log(`   Name: ${updated[0].name}`);
        console.log(`   Email: ${updated[0].email || 'N/A'}`);
        console.log(`   Phone: ${updated[0].phone || 'N/A'}`);
        console.log(`   Address: ${updated[0].address || 'N/A'}`);
      }
    } else if (hotelDetails.name === 'Famous Gates Hotels') {
      console.log('✅ Hotel name is already correct: "Famous Gates Hotels"');
      console.log('   No changes needed.');
    } else {
      console.log(`⚠️  Hotel name is set to: "${hotelDetails.name}"`);
      console.log('   Should it be "Famous Gates Hotels"? Updating...\n');

      const { data: updated, error: updateError } = await supabase
        .from('hotel_details')
        .update({ 
          name: 'Famous Gates Hotels',
          updated_at: new Date().toISOString()
        })
        .eq('id', hotelDetails.id)
        .select();

      if (updateError) {
        console.error('❌ Error updating hotel details:', updateError);
      } else {
        console.log('✅ Successfully updated hotel name to "Famous Gates Hotels"');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log('='.repeat(60));
    console.log('Hotel Chain Name: Famous Gates Hotels');
    console.log('Branch Name (ID 1): Kyogong');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixHotelDetails();
