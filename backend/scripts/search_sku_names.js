require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const testSkus = ['FG-5', 'FG-417', 'FG-418', 'FGH-BEERS-001', 'FGH-BEERS-010', 'FG-79', 'FG-86'];
    console.log('Searching for test SKUs across tables:', testSkus);

    // Check inventory_item_catalog
    try {
      const res = await client.query(`SELECT * FROM inventory_item_catalog WHERE sku = ANY($1)`, [testSkus]);
      console.log('inventory_item_catalog results:', res.rows);
    } catch(e) { console.log('inventory_item_catalog err:', e.message); }

    // Check inventory_items across ALL branches
    try {
      const res = await client.query(`SELECT branch_id, sku, item_name, category FROM inventory_items WHERE sku = ANY($1)`, [testSkus]);
      console.log('inventory_items across all branches:', res.rows);
    } catch(e) { console.log('inventory_items err:', e.message); }

    // Check restaurant_menu_items / menu_items
    try {
      const res = await client.query(`SELECT name, sku FROM restaurant_menu_items WHERE sku = ANY($1)`, [testSkus]);
      console.log('restaurant_menu_items:', res.rows);
    } catch(e) { console.log('restaurant_menu_items err:', e.message); }

    // Check bar_menu_items
    try {
      const res = await client.query(`SELECT name, sku FROM bar_menu_items WHERE sku = ANY($1)`, [testSkus]);
      console.log('bar_menu_items:', res.rows);
    } catch(e) { console.log('bar_menu_items err:', e.message); }

    // Check recipes
    try {
      const res = await client.query(`SELECT raw_item_name, raw_item_sku, produced_item_name, produced_item_sku FROM recipes WHERE raw_item_sku = ANY($1) OR produced_item_sku = ANY($1)`, [testSkus]);
      console.log('recipes:', res.rows);
    } catch(e) { console.log('recipes err:', e.message); }

    // Check kitchen_production_recipes
    try {
      const res = await client.query(`SELECT raw_item_name, raw_item_sku, produced_item_name, produced_item_sku FROM kitchen_production_recipes WHERE raw_item_sku = ANY($1) OR produced_item_sku = ANY($1)`, [testSkus]);
      console.log('kitchen_production_recipes:', res.rows);
    } catch(e) { console.log('kitchen_production_recipes err:', e.message); }

    // Check store_grn_items or store_purchase_order_items
    try {
      const res = await client.query(`SELECT item_name, item_sku FROM store_grn_items WHERE item_sku = ANY($1) LIMIT 10`, [testSkus]);
      console.log('store_grn_items:', res.rows);
    } catch(e) { console.log('store_grn_items err:', e.message); }

    // Check store_purchase_order_items
    try {
      const res = await client.query(`SELECT item_name, item_sku FROM store_purchase_order_items WHERE item_sku = ANY($1) LIMIT 10`, [testSkus]);
      console.log('store_purchase_order_items:', res.rows);
    } catch(e) { console.log('store_purchase_order_items err:', e.message); }

    // Check store_dispatches
    try {
      const res = await client.query(`SELECT item_name, item_sku FROM store_dispatches WHERE item_sku = ANY($1) LIMIT 10`, [testSkus]);
      console.log('store_dispatches:', res.rows);
    } catch(e) { console.log('store_dispatches err:', e.message); }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
