/**
 * Test Geolocation Capture
 * 
 * This script checks if new auth_logs are capturing geolocation data correctly
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGeolocationCapture() {
  console.log('🔍 Testing Geolocation Capture...\n');

  try {
    // Get the most recent auth_logs
    const { data: logs, error } = await supabase
      .from('auth_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching auth_logs:', error);
      return;
    }

    if (!logs || logs.length === 0) {
      console.log('⚠️  No auth_logs found. Try logging in first.');
      return;
    }

    console.log(`📊 Analyzing ${logs.length} most recent login attempts:\n`);

    let withGeo = 0;
    let withoutGeo = 0;

    logs.forEach((log, index) => {
      const hasGeo = log.geo_country && log.geo_city;
      const status = hasGeo ? '✅' : '❌';
      
      console.log(`${status} Log #${index + 1}:`);
      console.log(`   Email: ${log.email}`);
      console.log(`   Status: ${log.status}`);
      console.log(`   IP: ${log.ip_address}`);
      console.log(`   Location: ${hasGeo ? `${log.geo_city}, ${log.geo_country}` : 'NOT CAPTURED'}`);
      console.log(`   Threat Score: ${log.threat_score !== null ? log.threat_score : 'NOT CAPTURED'}`);
      console.log(`   Timestamp: ${new Date(log.created_at).toLocaleString()}`);
      console.log('');

      if (hasGeo) {
        withGeo++;
      } else {
        withoutGeo++;
      }
    });

    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`✅ With Geolocation: ${withGeo}/${logs.length}`);
    console.log(`❌ Without Geolocation: ${withoutGeo}/${logs.length}`);
    console.log('='.repeat(60));

    if (withoutGeo > 0) {
      console.log('\n⚠️  Some logs are missing geolocation data!');
      console.log('\n🔧 Possible fixes:');
      console.log('   1. Restart backend: cd backend && npm run dev');
      console.log('   2. Run backfill script: node backfill-geolocation.js');
      console.log('   3. Try logging in again to test');
    } else {
      console.log('\n✅ All recent logs have geolocation data!');
      console.log('   The system is working correctly.');
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

// Run the test
testGeolocationCapture()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
