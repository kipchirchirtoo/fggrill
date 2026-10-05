require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    console.log('=== CHECKING BOMET TOWN (BRANCH 2) ALL REGISTERED STORE STOCK ===');

    // 1. branch_stock
    const bsAll = await client.query(`
      SELECT bs.id, bs.branch_id, bs.item_sku, bs.item_name, bs.current_stock, bs.quantity, 
             bs.reorder_level, bs.minimum_stock, bs.unit_cost, bs.updated_at,
             ii.category, ii.unit, ii.retail_price, ii.is_active
      FROM branch_stock bs
      LEFT JOIN inventory_items ii ON ii.sku = bs.item_sku AND ii.branch_id = bs.branch_id
      WHERE bs.branch_id = 2
      ORDER BY COALESCE(ii.category, 'RAW_STORE_STOCK'), bs.item_name, bs.item_sku
    `);
    console.log(`Total branch_stock items for branch 2: ${bsAll.rows.length}`);

    // Count with non-zero stock
    const nonZero = bsAll.rows.filter(r => Number(r.current_stock) > 0 || Number(r.quantity) > 0);
    console.log(`branch_stock items with current_stock > 0: ${nonZero.length}`);

    // Group by category
    const byCategory = {};
    for (const r of bsAll.rows) {
      const cat = r.category || 'RAW_KITCHEN_STORE_STAPLES';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(r);
    }

    console.log('\n--- Categories in branch_stock ---');
    for (const [cat, items] of Object.entries(byCategory)) {
      const activeCount = items.filter(i => Number(i.current_stock) > 0 || Number(i.quantity) > 0).length;
      const totalStock = items.reduce((sum, i) => sum + Number(i.current_stock || 0), 0);
      console.log(`Category: ${cat} | Total Items: ${items.length} | Items with Stock > 0: ${activeCount} | Total Units: ${totalStock}`);
    }

    // 2. inventory_items
    const iiAll = await client.query(`
      SELECT id, sku, item_name, category, unit, cost_price, retail_price, quantity, reorder_level, is_active
      FROM inventory_items
      WHERE branch_id = 2
      ORDER BY category, item_name
    `);
    console.log(`\nTotal inventory_items for branch 2: ${iiAll.rows.length}`);

    // Check items in inventory_items not in branch_stock
    const bsSkus = new Set(bsAll.rows.map(r => r.item_sku));
    const iiOnly = iiAll.rows.filter(r => !bsSkus.has(r.sku));
    console.log(`inventory_items not present in branch_stock: ${iiOnly.length}`);

    // 3. bar_stock
    const barCols = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'bar_stock'
    `);
    console.log('bar_stock columns:', barCols.rows.map(c => c.column_name).join(', '));
    const barStock = await client.query(`
      SELECT * FROM bar_stock WHERE branch_id = 2
    `);
    console.log(`Total bar_stock items for branch 2: ${barStock.rows.length}`);
    if (barStock.rows.length > 0) {
      console.log('Sample bar_stock row:', barStock.rows[0]);
    }

    // 4. Kitchen stock / other stock tables
    const ks = await client.query(`
      SELECT count(*) FROM kitchen_stock WHERE branch_id = 2
    `);
    console.log(`kitchen_stock count for branch 2: ${ks.rows[0].count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
