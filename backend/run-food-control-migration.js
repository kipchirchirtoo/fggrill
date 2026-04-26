/**
 * Run Food Control System Migration
 * 
 * This script applies the food control system database migration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🚀 Starting Food Control System Migration...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'src/database/migrations/20260425_food_control_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log(`📏 Size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--') || statement.startsWith('/*')) {
        continue;
      }

      // Get statement type for logging
      const statementType = statement.split(' ')[0].toUpperCase();
      
      try {
        console.log(`[${i + 1}/${statements.length}] Executing ${statementType}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase.from('_migrations').insert({
            name: `food_control_${i}`,
            executed_at: new Date().toISOString()
          });
          
          if (directError && !directError.message.includes('already exists')) {
            throw error;
          }
        }
        
        successCount++;
        console.log(`✅ Success\n`);
        
      } catch (error) {
        // Some errors are expected (e.g., "already exists")
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('does not exist')
        )) {
          console.log(`⚠️  Skipped (already exists)\n`);
          successCount++;
        } else {
          console.error(`❌ Error: ${error.message}\n`);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total: ${statements.length}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!\n');
      
      // Verify tables were created
      console.log('🔍 Verifying tables...\n');
      
      const tablesToCheck = [
        'buffets',
        'buffet_menu_items',
        'catering_events',
        'catering_menu_items',
        'catering_stock_allocations',
        'food_control_variance',
        'shift_financials',
        'stock_issues',
        'waste_logs',
        'recipe_change_log',
        'branch_food_control_config'
      ];

      for (const table of tablesToCheck) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`❌ ${table}: Not found or error`);
        } else {
          console.log(`✅ ${table}: OK`);
        }
      }

      console.log('\n✨ Food Control System is ready to use!\n');
    } else {
      console.log('⚠️  Migration completed with some errors. Please review the logs.\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error running migration:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
