const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const tables = [
  'rooms', 'staff_profiles', 'restaurant_orders', 'bar_orders', 'bookings',
  'expenses', 'simple_items', 'cashier_transactions', 'stock_requests',
  'branch_stock', 'branch_stock_movements', 'inventory_items',
  'menu_items', 'shifts', 'store_items', 'staff_attendance', 'hk_tasks',
  'reservations', 'pos_transactions', 'folio_transactions', 'stock_movements',
  'store_inventory', 'kitchen_food_control_logs', 'staff_advances',
  'staff_loans', 'staff_payroll_adjustments'
];

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Checking branch_id column in all tables...\n');
    
    const missing = [];
    const existing = [];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'branch_id'
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        existing.push(table);
        console.log(`✓ ${table}`);
      } else {
        missing.push(table);
        console.log(`✗ ${table} - MISSING branch_id`);
      }
    }
    
    console.log(`\n\nSummary:`);
    console.log(`With branch_id: ${existing.length}/${tables.length}`);
    console.log(`Missing branch_id: ${missing.length}/${tables.length}`);
    
    if (missing.length > 0) {
      console.log(`\nTables missing branch_id:`);
      missing.forEach(t => console.log(`  - ${t}`));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

check();
