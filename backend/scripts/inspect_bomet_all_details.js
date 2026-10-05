require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check branch_stock item_name nulls or values
    const bsSample = await client.query(`
      SELECT item_sku, item_name, current_stock, quantity, unit_cost
      FROM branch_stock
      WHERE branch_id = 2
      ORDER BY item_sku
      LIMIT 30
    `);
    console.log('Sample branch_stock rows:');
    console.table(bsSample.rows);

    const bsNullNames = await client.query(`
      SELECT count(*) FROM branch_stock WHERE branch_id = 2 AND (item_name IS NULL OR item_name = '')
    `);
    console.log(`branch_stock with NULL or empty item_name: ${bsNullNames.rows[0].count}`);

    // If item_name is null in branch_stock, where are names stored?
    // Let's check inventory_items or inventory_item_catalog or recipes or menu_items
    if (Number(bsNullNames.rows[0].count) > 0) {
      const nullSkus = await client.query(`
        SELECT item_sku FROM branch_stock WHERE branch_id = 2 AND (item_name IS NULL OR item_name = '') LIMIT 10
      `);
      console.log('Sample null SKUs:', nullSkus.rows.map(r => r.item_sku));

      // Check across catalog tables
      const catCheck = await client.query(`
        SELECT * FROM inventory_item_catalog WHERE sku = ANY($1)
      `, [nullSkus.rows.map(r => r.item_sku)]);
      console.log('Found in inventory_item_catalog:', catCheck.rows);

      // Check simple_items or stock tables
      const rCheck = await client.query(`
        SELECT * FROM recipes WHERE raw_item_sku = ANY($1) OR produced_item_sku = ANY($1)
      `, [nullSkus.rows.map(r => r.item_sku)]);
      console.log('Found in recipes:', rCheck.rows);

      // Check kitchen_production_recipes
      const kprCheck = await client.query(`
        SELECT * FROM kitchen_production_recipes WHERE raw_item_sku = ANY($1) OR produced_item_sku = ANY($1)
      `, [nullSkus.rows.map(r => r.item_sku)]);
      console.log('Found in kitchen_production_recipes:', kprCheck.rows);
    }

    // 2. Check inventory_items categories and items
    const iiCats = await client.query(`
      SELECT category, count(*), sum(quantity) as total_qty, 
             count(CASE WHEN is_active THEN 1 END) as active_count
      FROM inventory_items
      WHERE branch_id = 2
      GROUP BY category
      ORDER BY count(*) DESC
    `);
    console.log('\ninventory_items breakdown for branch 2:');
    console.table(iiCats.rows);

    // 3. Check bar_stock for branch 2
    const barStock = await client.query(`
      SELECT item_sku, item_name, current_stock, unit, low_stock
      FROM bar_stock
      WHERE branch_id = 2
      ORDER BY item_name
    `);
    console.log(`\nbar_stock items count: ${barStock.rows.length}`);
    console.log('bar_stock sample (15):');
    console.table(barStock.rows.slice(0, 15));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
