require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    console.log('=== kitchen_production_recipes columns ===');
    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='kitchen_production_recipes' ORDER BY ordinal_position`
    );
    console.log(cols.rows);

    console.log('\n=== how many recipes have pos_outlet_item_id populated ===');
    const r = await client.query(`SELECT count(*) total, count(pos_outlet_item_id) linked FROM kitchen_production_recipes`);
    console.log(r.rows);

    console.log('\n=== pos_outlet_items sample names for branch 2 restaurant outlet (to compare vs recipe produced_item_name) ===');
    const r2 = await client.query(`
      SELECT poi.id, poi.name, po.outlet_type
      FROM pos_outlet_items poi
      JOIN pos_outlets po ON po.id = poi.outlet_id
      WHERE po.branch_id = 2 AND po.outlet_type = 'restaurant'
      ORDER BY poi.name
      LIMIT 80
    `);
    console.log(r2.rows.map(x => x.name));
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
