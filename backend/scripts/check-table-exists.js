const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const tables = ['simple_items', 'stock_requests', 'inventory_items', 'menu_items', 'shifts', 'store_items', 'staff_payroll_adjustments'];

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)
      `, [table]);
      
      console.log(`${result.rows[0].exists ? '✓' : '✗'} ${table}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

check();
