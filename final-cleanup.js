require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');

async function finalCleanup() {
  console.log('🗑️ FINAL COMPREHENSIVE CLEANUP\n');
  console.log('='.repeat(80));
  
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    await client.query('BEGIN');
    console.log('✅ Transaction started\n');
    
    const tablesToDelete = [
      '_migrations',
      'accounting_journal_entries',
      'audit_trail',
      'banking_transactions',
      'blocked_ips',
      'branch_food_control_config',
      'channel_messages',
      'communication_channels',
      'conference_hall_bookings',
      'conference_halls',
      'discrepancy_flags',
      'dispatch_sequences',
      'dispatches',
      'dynamic_services',
      'license_keys',
      'message_reactions',
      'outside_catering_bookings',
      'payroll_runs',
      'petty_cash_transactions',
      'sales_points',
      'scheduled_reports',
      'schema_migrations',
      'security_alerts',
      'security_config',
      'staff_employment_history',
      'stock_request_sequences',
      'store_procurement_audit_logs',
      'sku_categories',
      'unpaid_bills',
    ];
    
    const viewsToDrop = [
      'restaurant_item_popularity',
    ];
    
    let deletedTotal = 0;
    
    for (const table of tablesToDelete) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        
        if (count === 0) {
          console.log(`  ✓ ${table.padEnd(40)} 0 records`);
          continue;
        }
        
        await client.query(`DELETE FROM ${table}`);
        console.log(`  ✅ ${table.padEnd(40)} ${count} records deleted`);
        deletedTotal += count;
      } catch (e) {
        console.log(`  ❌ ${table.padEnd(40)} ${e.message}`);
      }
    }
    
    console.log('\nDropping views:\n');
    for (const view of viewsToDrop) {
      try {
        await client.query(`DROP VIEW IF EXISTS ${view} CASCADE`);
        console.log(`  ✅ Dropped view: ${view}`);
      } catch (e) {
        console.log(`  ⏭️  ${view} (${e.message})`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ Transaction committed`);
    console.log(`\n📊 Total records deleted: ${deletedTotal}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ FINAL CLEANUP COMPLETE!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await client.query('ROLLBACK');
    console.log('✅ Rollback successful');
    process.exit(1);
  } finally {
    await client.end();
  }
}

finalCleanup();
