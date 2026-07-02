const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/famous_gates',
});

async function run() {
  try {
    // Begin transaction
    await pool.query('BEGIN');

    // Update pos_outlet_items
    const updateQuery = await pool.query(`
      UPDATE pos_outlet_items poi
      SET current_stock = current_stock + 87
      FROM pos_outlets o
      WHERE poi.outlet_id = o.id
      AND (poi.name ILIKE '%pool%' OR poi.name ILIKE '%token%')
      AND (o.name ILIKE '%main bar%' OR o.outlet_code ILIKE '%MAIN%')
      RETURNING o.name as outlet_name, poi.name as item_name, poi.current_stock as new_stock;
    `);

    // Let's also find the underlying inventory_items and update them just in case bar stock 
    // is tracked at the inventory_item level as well, though typically pos_outlet_items is the POS local stock.
    // Wait, let's just stick to pos_outlet_items for now unless requested otherwise, since the previous check
    // confirmed that's where the mapping exists.
    // Wait, the user said "make them have additions of 87".
    // "them" might mean both the pos_outlet_items and the main inventory_items. Let's update both just to be safe?
    // Actually, usually POS stock is what the cashier sees, so pos_outlet_items is correct.

    await pool.query('COMMIT');
    
    console.log('\n--- STOCK UPDATED ---');
    console.log(`Updated ${updateQuery.rowCount} items.`);
    updateQuery.rows.forEach(r => console.log(`- ${r.item_name} -> ${r.outlet_name} (New Stock: ${r.new_stock})`));
  } catch(e) {
    await pool.query('ROLLBACK');
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
