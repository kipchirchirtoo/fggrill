const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract database connection details from Supabase URL
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl && (!supabaseUrl || !supabaseKey)) {
  console.error('❌ Missing database connection details');
  console.error('   Set either DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function applyMigrationDirect() {
  let client;
  
  try {
    console.log('🔒 Applying Security & Geolocation Migration (Direct Method)...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/013_add_geolocation_security_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    if (dbUrl) {
      // Use direct PostgreSQL connection
      console.log('📡 Connecting to database directly...');
      client = new Client({ connectionString: dbUrl });
      await client.connect();
      console.log('✅ Connected!\n');

      console.log('📝 Executing migration SQL...\n');
      await client.query(migrationSQL);
      
      console.log('\n✅ Migration completed successfully!');
    } else {
      // Fallback: Use Supabase client with individual queries
      console.log('📡 Using Supabase client...\n');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Split and execute statements individually
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      console.log(`📝 Executing ${statements.length} statements...\n`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`[${i + 1}/${statements.length}] Executing...`);
        
        try {
          // Try to execute via raw SQL if available
          const { error } = await supabase.rpc('exec', { sql: statement + ';' });
          if (error && !error.message.includes('already exists')) {
            console.warn(`   ⚠️  Warning:`, error.message.substring(0, 100));
          }
        } catch (err) {
          console.warn(`   ⚠️  Warning:`, err.message.substring(0, 100));
        }
      }

      console.log('\n✅ Migration attempted!');
      console.log('\n⚠️  Note: Some statements may need to be run manually in Supabase SQL Editor');
    }

    console.log('\n📊 New Security Features Added:');
    console.log('   • IP Geolocation tracking (country, city, coordinates)');
    console.log('   • Threat detection (VPN, Proxy, Datacenter detection)');
    console.log('   • IP Blocklist & Whitelist management');
    console.log('   • Active Sessions tracking');
    console.log('   • Security Alerts system');
    console.log('   • Brute force attack detection (automatic)');
    console.log('   • Geographic anomaly detection (impossible travel)');
    console.log('\n🔐 Security Dashboard is now ready to use!');
    console.log('   Navigate to: /dashboard/super/admin/security\n');

  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.error('\n💡 Alternative: Run the SQL manually in Supabase Dashboard');
    console.error('   1. Go to: https://app.supabase.com/project/_/sql');
    console.error('   2. Copy contents of: database/migrations/013_add_geolocation_security_fields.sql');
    console.error('   3. Paste and run in SQL Editor\n');
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

applyMigrationDirect();
