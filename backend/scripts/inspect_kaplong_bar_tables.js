require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const outlets = await pool.query('SELECT id, name, outlet_type, branch_id FROM pos_outlets WHERE branch_id = 3');
  console.log('Outlets in Kaplong:', outlets.rows);

  const barStock = await pool.query('SELECT count(*) FROM bar_stock WHERE branch_id = 3');
  console.log('bar_stock count in Kaplong:', barStock.rows[0].count);

  const barDrinks = await pool.query('SELECT count(*) FROM bar_drinks WHERE branch_id = 3');
  console.log('bar_drinks count in Kaplong:', barDrinks.rows[0].count);

  const branchStock = await pool.query('SELECT count(*) FROM branch_stock WHERE branch_id = 3');
  console.log('branch_stock count in Kaplong:', branchStock.rows[0].count);

  await pool.end();
}
main().catch(err => { console.error(err); process.exit(1); });
