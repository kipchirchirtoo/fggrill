/**
 * Apply Payments RLS Fix Migration
 * Adds kyogong_transaction_id column and RLS policies to payments table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Use service role key to bypass RLS and execute DDL statements
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('='.repeat(80));
  console.log('APPLYING PAYMENTS RLS FIX MIGRATION');
  console.log('='.repeat(80));

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'backend/supabase/migrations/31_fix_payments_rls_kyogong.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n[1] Migration file loaded');
    console.log('⚠ NOTE: This script will output the SQL statements.');
    console.log('⚠ You need to run these statements manually in Supabase SQL Editor');
    console.log('⚠ OR use a PostgreSQL client with direct database access');

    console.log('\n' + '='.repeat(80));
    console.log('SQL TO EXECUTE IN SUPABASE SQL EDITOR:');
    console.log('='.repeat(80));
    console.log(migrationSQL);
    console.log('='.repeat(80));

    console.log('\n[2] Testing current payments table access...');
    
    // Test if we can query payments table
    const { data: testQuery, error: queryError } = await supabase
      .from('payments')
      .select('id, reference, amount, payment_method, status')
      .limit(1);

    if (queryError) {
      console.error('❌ Cannot query payments table:', queryError.message);
    } else {
      console.log('✓ Payments table is accessible');
      console.log(`  Found ${testQuery?.length || 0} payment(s)`);
    }

    console.log('\n[3] Testing payment insertion (this will likely fail due to RLS)...');
    
    const testPayment = {
      reference: `TEST-${Date.now()}`,
      amount: 100,
      currency: 'KES',
      payment_method: 'cash',
      status: 'completed',
      metadata: { test: true }
    };

    const { data: testInsert, error: insertError } = await supabase
      .from('payments')
      .insert(testPayment)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Payment insertion failed (EXPECTED):', insertError.message);
      console.log('   Error code:', insertError.code);
      
      if (insertError.code === '42501') {
        console.log('   ✓ Confirmed: RLS policy violation (this is the bug we\'re fixing)');
      }
    } else {
      console.log('✓ Payment insertion successful');
      console.log('  Payment ID:', testInsert.id);
      
      // Clean up
      await supabase.from('payments').delete().eq('id', testInsert.id);
      console.log('  ✓ Test payment cleaned up');
    }

    console.log('\n' + '='.repeat(80));
    console.log('NEXT STEPS:');
    console.log('='.repeat(80));
    console.log('1. Copy the SQL statements above');
    console.log('2. Go to Supabase Dashboard → SQL Editor');
    console.log('3. Paste and run the SQL');
    console.log('4. Run this script again to verify the fix');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
applyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

