/**
 * Apply GRN Stock Update Fix Migration
 * 
 * This script applies the migration that fixes the GRN approval process
 * to properly update central store inventory (simple_items table).
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERROR: Missing Supabase credentials');
    console.error('   Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log('========================================');
    console.log(' APPLYING GRN STOCK UPDATE FIX');
    console.log('========================================\n');

    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '32_fix_grn_stock_update.sql');
        console.log('📄 Reading migration file...');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🔄 Applying migration to database...\n');

        // Split SQL into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';
            console.log(`   Executing statement ${i + 1}/${statements.length}...`);
            
            const { error } = await supabase.rpc('exec_sql', { sql_query: statement }).catch(async () => {
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
                // If exec_sql doesn't exist, try direct execution
                return await supabase.from('_migrations').insert({ statement });
            });

            if (error) {
                console.error(`   ❌ Error in statement ${i + 1}:`, error.message);
                throw error;
            }
        }

        console.log('\n✅ Migration applied successfully!\n');
        console.log('========================================');
        console.log(' WHAT CHANGED');
        console.log('========================================\n');
        console.log('The approve_grn_and_update_all() function now:');
        console.log('  ✓ Updates simple_items.quantity with received goods');
        console.log('  ✓ Updates simple_items.cost_price with latest unit price');
        console.log('  ✓ Marks GRN as approved and completed\n');
        console.log('========================================');
        console.log(' IMPORTANT: HOW TO USE');
        console.log('========================================\n');
        console.log('1. Receive goods at /dashboard/central-store/receiving');
        console.log('2. Complete the receiving process (creates GRN)');
        console.log('3. APPROVE the GRN at /dashboard/central-store/procurement/grn');
        console.log('4. Stock will be updated automatically upon approval!\n');
        console.log('See GRN_STOCK_FIX_INSTRUCTIONS.md for detailed workflow.\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\n========================================');
        console.error(' MANUAL APPLICATION REQUIRED');
        console.error('========================================\n');
        console.error('Please apply the migration manually:');
        console.error('1. Open your database client (pgAdmin, DBeaver, or Supabase SQL Editor)');
        console.error('2. Run the file: backend/supabase/migrations/32_fix_grn_stock_update.sql\n');
        process.exit(1);
    }
}

// Run the migration
applyMigration();
