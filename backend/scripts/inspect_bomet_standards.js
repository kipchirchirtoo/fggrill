require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kitchen_production_recipes'
      ORDER BY ordinal_position
    `);
    console.log('kitchen_production_recipes columns:');
    console.table(cols.rows);

    const rows = await client.query(`
      SELECT * FROM kitchen_production_recipes WHERE branch_id = 2 ORDER BY raw_item_name, produced_item_name
    `);
    console.log(`Total rows in kitchen_production_recipes for branch 2: ${rows.rows.length}`);
    
    // Group by raw item
    const byRaw = {};
    rows.rows.forEach(r => {
      const rawKey = `${r.raw_item_name} (${r.raw_item_sku || 'no sku'}) [${r.raw_quantity} ${r.raw_unit}]`;
      if (!byRaw[rawKey]) byRaw[rawKey] = [];
      byRaw[rawKey].push(r);
    });

    console.log(`\nUnique Raw Stock items: ${Object.keys(byRaw).length}`);
    for (const [rawKey, producedList] of Object.entries(byRaw)) {
      console.log(`\n--- RAW: ${rawKey} ---`);
      producedList.forEach(p => {
        console.log(`   -> Produces: ${p.produced_quantity} ${p.produced_unit} of "${p.produced_item_name}" (SKU: ${p.produced_item_sku || '-'}, Active: ${p.is_active})`);
      });
    }

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
