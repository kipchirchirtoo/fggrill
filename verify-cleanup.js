require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');

async function verifyCleanup() {
  console.log('📊 CLEANUP VERIFICATION\n');
  console.log('='.repeat(80));
  
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const tables = [
      'users', 'branches', 'staff_profiles', 'departments', 'room_types',
      'restaurant_menu_items', 'restaurant_menu_categories', 'vehicles',
      'maintenance_spare_parts', 'kenyan_public_holidays',
      'payroll_records', 'auth_logs', 'notifications', 'stock_requests',
      'stock_request_items', 'restaurant_orders', 'restaurant_order_items',
      'payments', 'guests', 'rooms', 'staff_loans', 'staff_advances',
      'approval_requests', 'daily_financial_records', 'credit_bills',
      'bookings', 'bar_orders', 'kitchen_orders', 'stock_dispatches',
      'stock_transfers', 'attendance_records', 'leave_requests',
      'overtime_records', 'maintenance_requests', 'housekeeping_tasks',
      'business_communications', 'audit_logs', 'security_events',
      'restaurant_bills', 'expense_records', 'revenue_records'
    ];
    
    console.log('MASTER DATA (should be preserved):\n');
    const masterTables = ['users', 'branches', 'staff_profiles', 'departments', 'room_types',
                          'restaurant_menu_items', 'restaurant_menu_categories', 'vehicles',
                          'maintenance_spare_parts', 'kenyan_public_holidays'];
    
    let masterCount = 0;
    for (const table of masterTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        masterCount += count;
        console.log(`  ✓ ${table.padEnd(40)} ${count} records`);
      } catch (e) {
        console.log(`  - ${table.padEnd(40)} (table doesn't exist)`);
      }
    }
    
    console.log(`\n  Total master data: ${masterCount} records`);
    
    console.log('\n' + '-'.repeat(80));
    console.log('TRANSACTIONAL DATA (should be 0):\n');
    
    const transactionalTables = tables.filter(t => !masterTables.includes(t));
    let transactionalCount = 0;
    for (const table of transactionalTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        transactionalCount += count;
        if (count > 0) {
          console.log(`  ⚠️  ${table.padEnd(40)} ${count} records`);
        } else {
          console.log(`  ✓ ${table.padEnd(40)} 0 records`);
        }
      } catch (e) {
        console.log(`  - ${table.padEnd(40)} (table doesn't exist)`);
      }
    }
    
    console.log(`\n  Total transactional data: ${transactionalCount} records`);
    
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:');
    console.log(`  Master data preserved: ${masterCount} records`);
    console.log(`  Transactional data remaining: ${transactionalCount} records`);
    console.log(`  Total records: ${masterCount + transactionalCount}`);
    
    if (transactionalCount === 0) {
      console.log('\n✅ CLEANUP SUCCESSFUL - All transactional data removed!');
    } else {
      console.log(`\n⚠️  CLEANUP INCOMPLETE - ${transactionalCount} transactional records remain`);
    }
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyCleanup();
