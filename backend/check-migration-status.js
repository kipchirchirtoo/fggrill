const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigrationStatus() {
  console.log('🔍 Checking Security Migration Status...\n');

  try {
    // Check if new columns exist in auth_logs
    console.log('1️⃣ Checking auth_logs table for new columns...');
    const { data: authLogs, error: authError } = await supabase
      .from('auth_logs')
      .select('geo_country, geo_city, threat_score, is_suspicious')
      .limit(1);

    if (authError) {
      if (authError.message.includes('column') && authError.message.includes('does not exist')) {
        console.log('   ❌ New columns NOT found in auth_logs');
        console.log('   📝 Migration needs to be applied\n');
      } else {
        console.log('   ⚠️  Error checking auth_logs:', authError.message);
      }
    } else {
      console.log('   ✅ New columns exist in auth_logs\n');
    }

    // Check if new tables exist
    const tablesToCheck = ['ip_blocklist', 'ip_whitelist', 'active_sessions', 'security_alerts'];
    
    console.log('2️⃣ Checking for new tables...');
    for (const table of tablesToCheck) {
      const { error } = await supabase.from(table).select('id').limit(1);
      
      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`   ❌ Table '${table}' does NOT exist`);
        } else {
          console.log(`   ⚠️  Error checking '${table}':`, error.message);
        }
      } else {
        console.log(`   ✅ Table '${table}' exists`);
      }
    }

    console.log('\n3️⃣ Testing geolocation service...');
    const axios = require('axios');
    try {
      const response = await axios.get('http://ip-api.com/json/8.8.8.8', { timeout: 5000 });
      if (response.data.status === 'success') {
        console.log('   ✅ Geolocation API is accessible');
        console.log(`   📍 Test: 8.8.8.8 → ${response.data.city}, ${response.data.country}`);
      }
    } catch (err) {
      console.log('   ⚠️  Geolocation API not accessible:', err.message);
    }

    console.log('\n📊 Summary:');
    console.log('─────────────────────────────────────────────────────');
    
    if (!authError) {
      console.log('✅ Migration appears to be COMPLETE');
      console.log('\n🎯 Next Steps:');
      console.log('   1. Restart backend: npm run dev');
      console.log('   2. Login to test IP tracking');
      console.log('   3. Access dashboard: /dashboard/super/admin/security');
    } else {
      console.log('❌ Migration needs to be APPLIED');
      console.log('\n🎯 Next Steps:');
      console.log('   1. Open Supabase SQL Editor');
      console.log('   2. Copy contents of: database/migrations/013_add_geolocation_security_fields.sql');
      console.log('   3. Paste and run in SQL Editor');
      console.log('   4. Run this script again to verify');
      console.log('\n📚 See MANUAL_MIGRATION_GUIDE.md for detailed instructions');
    }
    console.log('─────────────────────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMigrationStatus();
