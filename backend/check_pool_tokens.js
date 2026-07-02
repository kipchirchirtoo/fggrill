const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/famous_gates',
});

async function run() {
  try {
    const tokensInOutlets = await pool.query(`
      SELECT o.name as outlet_name, poi.name as item_name, poi.current_stock
      FROM pos_outlet_items poi
      JOIN pos_outlets o ON poi.outlet_id = o.id
      WHERE (poi.name ILIKE '%pool%' OR poi.name ILIKE '%token%')
      AND (o.name ILIKE '%main bar%' OR o.outlet_code ILIKE '%MAIN%')
    `);
    console.log('\n--- POOL TOKENS DIRECTLY IN pos_outlet_items FOR MAIN BAR ---');
    console.log(`Count: ${tokensInOutlets.rows.length}`);
    tokensInOutlets.rows.forEach(r => console.log(`- ${r.item_name} -> ${r.outlet_name} (Stock: ${r.current_stock})`));
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
