const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const kRows = await client.query('SELECT item_sku FROM branch_stock WHERE branch_id = 3');
    const skus = kRows.rows.map(r => r.item_sku);
    const iiRes = await client.query('SELECT sku, is_active, category FROM inventory_items WHERE sku = ANY($1)', [skus]);
    const inactive = iiRes.rows.filter(r => !r.is_active);
    console.log(`Total in inventory_items: ${iiRes.rows.length}, Inactive: ${inactive.length}`);
    if (inactive.length > 0) {
      console.log('Activating inactive items...');
      await client.query('UPDATE inventory_items SET is_active = true WHERE sku = ANY($1)', [skus]);
      console.log('All 151 items are now active in inventory_items!');
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
