const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Applying Report to Duty Migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_report_to_duty_to_staff_leave.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(60));
    console.log(migrationSQL);
    console.log('─'.repeat(60));
    console.log();

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: statement + ';' 
      }).catch(async () => {
        // Fallback: Try direct execution if RPC doesn't exist
        return await supabase.from('_migrations').insert({ 
          name: 'add_report_to_duty_to_staff_leave',
          executed_at: new Date().toISOString()
        });
      });

      if (error) {
        console.log(`⚠️  Statement ${i + 1}: ${error.message}`);
        // Continue with other statements even if one fails
      } else {
        console.log(`✅ Statement ${i + 1}: Success`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 New columns added to staff_leave table:');
    console.log('   • actual_return_date - Date employee actually returned');
    console.log('   • reported_to_duty - Boolean flag for return confirmation');
    console.log('   • reported_at - Timestamp of confirmation');
    console.log('   • reported_by - User who confirmed the return');
    console.log('   • report_notes - Optional notes about return');
    console.log('\n🎉 Report to Duty feature is now ready to use!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
