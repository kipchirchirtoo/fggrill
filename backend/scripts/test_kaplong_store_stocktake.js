const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const branchId = 3;

    // Simulate store-stocktake.controller.ts getRecords for branch 3
    const branchStockRes = await client.query('SELECT item_sku, quantity FROM branch_stock WHERE branch_id = $1', [branchId]);
    const invItemsRes = await client.query('SELECT id, sku, item_name, unit, category, store_type, default_unit_cost FROM inventory_items WHERE is_active = true');

    const NON_STORE_TYPES = ['bar_store', 'kitchen'];
    const isStoreCountableItem = (i, bId) => {
      if (!i) return false;
      const category = String(i.category || '').trim().toLowerCase();
      if (category === 'kitchen menu') return false;
      if (bId === 3) return true;
      const storeType = String(i.store_type || '').toLowerCase();
      if (NON_STORE_TYPES.includes(storeType)) return false;
      return true;
    };

    const stockRows = branchStockRes.rows;
    const stockBySkuMap = new Map();
    for (const r of stockRows) {
      if (r.item_sku) stockBySkuMap.set(r.item_sku, Number(r.quantity || 0));
    }

    const invMap = new Map();
    for (const item of invItemsRes.rows.filter(it => isStoreCountableItem(it, branchId))) {
      if (item.sku && stockBySkuMap.has(item.sku)) {
        invMap.set(item.sku, item);
      }
    }

    for (const r of stockRows) {
      if (r.item_sku && !invMap.has(r.item_sku)) {
        invMap.set(r.item_sku, {
          id: r.item_sku,
          sku: r.item_sku,
          item_name: r.item_sku,
          unit: 'units',
          category: 'GENERAL',
          store_type: 'general_store',
          quantity: Number(r.quantity || 0)
        });
      }
    }

    console.log(`Total countable store stocktake items for Kaplong: ${invMap.size}`);
    const items = Array.from(invMap.values());
    console.log('Sample items:');
    console.table(items.slice(0, 20).map(i => ({ sku: i.sku, name: i.item_name, cat: i.category, unit: i.unit })));

    // Breakdown by category
    const cats = {};
    items.forEach(i => {
      const c = i.category || 'GENERAL';
      cats[c] = (cats[c] || 0) + 1;
    });
    console.log('\nCategory breakdown for Kaplong Store Stocktake:');
    console.table(cats);

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
