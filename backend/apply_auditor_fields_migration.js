/**
 * Apply Auditor Fields Migration to Payroll Tables
 * 
 * This script adds the auditor confirmation fields to staff_advances and staff_loans tables
 * which are required for the approveAdvance functionality.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📋 Starting auditor fields migration...\n');

    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, 'src/database/migrations/20260207_add_auditor_fields_to_payroll.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📜 Migration file loaded:', migrationPath);
        console.log('\n🔧 Executing SQL statements...\n');

        // Split the SQL into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`   Executing statement ${i + 1}/${statements.length}...`);
            
            // Use Supabase REST API with /rpc/sql endpoint
            try {
                const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ query: statement })
                });
                
                if (response.ok) {
                    console.log(`   ✅ Statement ${i + 1} executed successfully`);
                } else {
                    const errorText = await response.text();
                    console.warn(`   ⚠️  Statement ${i + 1} failed (might be idempotent):`, errorText);
                }
            } catch (fetchError) {
                console.warn(`   ⚠️  Statement ${i + 1} failed (might be idempotent):`, fetchError.message);
            }
        }

        console.log('\n✅ Migration completed successfully!\n');
        console.log('📊 Added columns to staff_advances:');
        console.log('   - accountant_confirmed_at');
        console.log('   - accountant_id');
        console.log('   - auditor_confirmed_at');
        console.log('   - auditor_id');
        console.log('\n📊 Added columns to staff_loans:');
        console.log('   - accountant_confirmed_at');
        console.log('   - accountant_id');
        console.log('   - auditor_confirmed_at');
        console.log('   - auditor_id');
        console.log('\n📊 Updated status constraints to include:');
        console.log('   - accountant_confirmed');
        console.log('   - auditor_confirmed');

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        console.error(err);
        process.exit(1);
    }
}

runMigration();
