const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findHotelInfo() {
  console.log('🔍 Searching for hotel information...\n');

  try {
    // Check hotel_info table
    console.log('Checking hotel_info table...');
    const { data: hotelInfo, error: infoError } = await supabase
      .from('hotel_info')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!infoError && hotelInfo) {
      console.log('✅ Found hotel_info table:\n');
      console.log(JSON.stringify(hotelInfo, null, 2));
      return;
    }

    // Check settings table
    console.log('\nChecking settings table...');
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .limit(10);

    if (!settingsError && settings && settings.length > 0) {
      console.log('✅ Found settings table:\n');
      settings.forEach(setting => {
        console.log(`   ${setting.key}: ${setting.value}`);
      });
      return;
    }

    // Check system_settings table
    console.log('\nChecking system_settings table...');
    const { data: systemSettings, error: systemError } = await supabase
      .from('system_settings')
      .select('*')
      .limit(10);

    if (!systemError && systemSettings && systemSettings.length > 0) {
      console.log('✅ Found system_settings table:\n');
      systemSettings.forEach(setting => {
        console.log(`   ${setting.key}: ${setting.value}`);
      });
      return;
    }

    // Check branches table for main branch
    console.log('\nChecking branches table...');
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('*')
      .order('id');

    if (!branchError && branches) {
      console.log('✅ Found branches:\n');
      branches.forEach(branch => {
        console.log(`   ID: ${branch.id} | Name: ${branch.name} | Is Central: ${branch.is_central}`);
      });
    }

    console.log('\n⚠️  Could not find a dedicated hotel_details or hotel_info table');
    console.log('   Hotel information might be stored in environment variables or config files');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

findHotelInfo();
