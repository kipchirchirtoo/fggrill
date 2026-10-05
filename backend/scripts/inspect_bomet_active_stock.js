require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // Check non-zero current_stock in branch_stock
    const activeBS = await client.query(`
      SELECT item_sku, item_name, current_stock, quantity, reorder_level, minimum_stock, unit_cost, updated_at
      FROM branch_stock
      WHERE branch_id = 2 AND (current_stock > 0 OR quantity > 0)
      ORDER BY item_sku
    `);
    console.log(`branch_stock with stock > 0: ${activeBS.rows.length} items`);
    console.log('Sample with stock > 0:');
    console.table(activeBS.rows.slice(0, 20));

    // Where are item descriptions/names for FG-... items?
    const checkSKUs = activeBS.rows.slice(0, 5).map(r => r.item_sku);
    console.log('\nChecking where SKUs exist in other tables for:', checkSKUs);

    // Check inventory_item_catalog, menu_items, etc.
    const tables = ['menu_items', 'restaurant_menu_items', 'bar_menu_items', 'recipes', 'recipe_items', 'channel_food_standards'];
    for (const t of tables) {
      try {
        const found = await client.query(`SELECT * FROM "${t}" WHERE sku = ANY($1) OR id::text = ANY($1) LIMIT 3`, [checkSKUs]);
        if (found.rows.length > 0) {
          console.log(`Found in ${t}:`, found.rows);
        }
      } catch (e) {
        // column may not exist
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
