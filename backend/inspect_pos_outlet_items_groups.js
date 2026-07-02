require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const directUrl = process.env.DATABASE_URL.replace(':6543', ':5432');
  const client = new Client({ connectionString: directUrl });
  try {
    await client.connect();

    console.log('--- pos_outlet_items: count by branch_id, item_group, track_stock ---');
    const { rows: groups } = await client.query(`
      SELECT branch_id, item_group, track_stock, is_active, COUNT(*) AS n
      FROM pos_outlet_items
      GROUP BY branch_id, item_group, track_stock, is_active
      ORDER BY branch_id, item_group, track_stock
    `);
    console.table(groups);

    console.log('--- pos_outlet_items: existing pool links (stock_pool_item_id IS NOT NULL) by branch/item_group ---');
    const { rows: poolLinks } = await client.query(`
      SELECT branch_id, item_group, COUNT(*) AS n
      FROM pos_outlet_items
      WHERE stock_pool_item_id IS NOT NULL
      GROUP BY branch_id, item_group
      ORDER BY branch_id, item_group
    `);
    console.table(poolLinks);

    console.log('--- pos_outlet_items: rows acting as a pool PARENT (referenced by others) by branch/item_group/track_stock ---');
    const { rows: parents } = await client.query(`
      SELECT p.branch_id, p.item_group, p.track_stock, COUNT(*) AS n
      FROM pos_outlet_items p
      WHERE p.id IN (SELECT stock_pool_item_id FROM pos_outlet_items WHERE stock_pool_item_id IS NOT NULL)
      GROUP BY p.branch_id, p.item_group, p.track_stock
      ORDER BY p.branch_id, p.item_group
    `);
    console.table(parents);

    console.log('--- column list: pos_outlet_items ---');
    const { rows: cols } = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'pos_outlet_items' ORDER BY ordinal_position
    `);
    console.table(cols);
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    console.error(e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
