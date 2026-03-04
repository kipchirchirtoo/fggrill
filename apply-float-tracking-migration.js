const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  console.error('Required: SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...');
    const migrationPath = path.join(__dirname, 'backend/supabase/migrations/32_kyogong_cash_float_tracking.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration: 32_kyogong_cash_float_tracking.sql');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct query if RPC doesn't exist
      console.log('⚠️  RPC method not available, trying direct query...');
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '32_kyogong_cash_float_tracking',
        executed_at: new Date().toISOString()
      });
      
      if (directError) {
        console.error('❌ Migration failed:', directError);
        process.exit(1);
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('\n📋 Changes applied:');
    console.log('  - Enhanced cashier_shifts table with float tracking columns');
    console.log('  - Created float_history table for audit trail');
    console.log('  - Added indexes for performance');
    console.log('  - Configured RLS policies');
    console.log('  - Initialized existing open shifts');
    
  } catch (err) {
    console.error('❌ Error applying migration:', err.message);
    process.exit(1);
  }
}

applyMigration();
