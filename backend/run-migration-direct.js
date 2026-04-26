const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting Food Control System Migration...\n');

  const migrationPath = path.join(__dirname, 'src/database/migrations/20260425_food_control_system.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration file loaded');
  console.log(`📏 Size: ${(sql.length / 1024).toFixed(2)} KB\n`);

  try {
    console.log('⚙️  Executing migration SQL...\n');
    
    // Execute the entire SQL file
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query
      if (error.message.includes('exec_sql')) {
        console.log('⚠️  exec_sql function not found, trying direct execution...\n');
        
        // Split SQL into individual statements and execute
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (!statement) continue;
          
          try {
            // Use Supabase's query method
            const { error: stmtError } = await supabase.from('_migrations').select('*').limit(0);
            
            // Since we can't execute arbitrary SQL via Supabase client,
            // we need to inform the user to run it manually
            console.log(`Statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
            
          } catch (err) {
            console.error(`❌ Error in statement ${i + 1}:`, err.message);
            errorCount++;
          }
        }
        
        console.log('\n⚠️  IMPORTANT: Supabase client cannot execute DDL statements directly.');
        console.log('📋 Please run the migration SQL manually using one of these methods:\n');
        console.log('1. Supabase Dashboard → SQL Editor → Paste the SQL from:');
        console.log('   backend/src/database/migrations/20260425_food_control_system.sql\n');
        console.log('2. Use psql command line:');
        console.log('   psql "postgresql://..." < backend/src/database/migrations/20260425_food_control_system.sql\n');
        console.log('3. Use Supabase CLI:');
        console.log('   supabase db push\n');
        
        process.exit(1);
      } else {
        throw error;
      }
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('============================================================');
    console.log('📊 Next Steps:');
    console.log('============================================================');
    console.log('1. Verify tables created in Supabase Dashboard');
    console.log('2. Test API endpoints');
    console.log('3. Configure branch settings');
    console.log('4. Train users');
    console.log('============================================================\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

runMigration();
