require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');

async function deleteRemainingData() {
  console.log('🗑️ DELETING REMAINING NON-PRESERVED DATA\n');
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
    
    // Tables to delete from
    const tablesToDelete = [
      // Accounting
      'accounting_journal_entries',
      
      // Audit/Security
      'audit_trail',
      'security_alerts',
      'blocked_ips',
      'security_config',
      
      // Banking
      'banking_transactions',
      
      // Staff
      'staff_employment_history',
      
      // Conference
      'conference_hall_bookings',
      'conference_halls',
      
      // Communication
      'channel_messages',
      'communication_channels',
      'message_reactions',
      
      // Bills/Payments
      'unpaid_bills',
      'petty_cash_transactions',
      
      // Payroll
      'payroll_runs',
      
      // Sales/Reports
      'sales_points',
      'scheduled_reports',
      
      // SKU
      'sku_categories',
      
      // Dynamic services
      'dynamic_services',
      
      // Store audit logs
      'store_procurement_audit_logs',
      
      // Sequences
      'dispatch_sequences',
      'stock_request_sequences',
      
      // Other
      'dispatches',
      'discrepancy_flags',
      'license_keys',
      'outside_catering_bookings',
      
      // Migrations (optional - can keep)
      '_migrations',
      'schema_migrations',
      
      // Views to drop
      'restaurant_item_popularity',
    ];
    
    let deletedTotal = 0;
    
    for (const table of tablesToDelete) {
      try {
        // Get count before delete
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        
        if (count === 0) {
          console.log(`  ✓ ${table.padEnd(40)} 0 records (already empty)`);
          continue;
        }
        
        // Delete all records
        await client.query(`DELETE FROM ${table}`);
        
        console.log(`  ✅ ${table.padEnd(40)} ${count} records deleted`);
        deletedTotal += count;
      } catch (e) {
        // Might be a view, try dropping it
        if (e.message.includes('view')) {
          try {
            await client.query(`DROP VIEW IF EXISTS ${table} CASCADE`);
            console.log(`  ✅ Dropped view: ${table}`);
          } catch (dropError) {
            console.log(`  ⏭️  Skipped ${table} (${e.message})`);
          }
        } else {
          console.log(`  ⏭️  Skipped ${table} (${e.message})`);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ Transaction committed`);
    console.log(`\n📊 Total records deleted: ${deletedTotal}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANUP COMPLETE!');
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

deleteRemainingData();
