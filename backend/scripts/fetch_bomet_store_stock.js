require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const catStats = await client.query(`
      SELECT COALESCE(category, 'UNCATEGORIZED') as category, is_active, count(*) as count, sum(quantity) as total_qty
      FROM inventory_items 
      WHERE branch_id = 2 
      GROUP BY category, is_active 
      ORDER BY category, is_active
    `);
    console.log('=== INVENTORY_ITEMS CATEGORY BREAKDOWN (Branch 2) ===');
    console.table(catStats.rows);

    // Also check what categories exist in branch_stock
    const bsCats = await client.query(`
      SELECT COALESCE(ii.category, 'UNKNOWN') as category, count(bs.id) as count, sum(bs.current_stock) as total_current_stock
      FROM branch_stock bs
      LEFT JOIN inventory_items ii ON ii.sku = bs.item_sku AND ii.branch_id = bs.branch_id
      WHERE bs.branch_id = 2
      GROUP BY ii.category
      ORDER BY count DESC
    `);
    console.log('\n=== BRANCH_STOCK LINKED CATEGORIES (Branch 2) ===');
    console.table(bsCats.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
