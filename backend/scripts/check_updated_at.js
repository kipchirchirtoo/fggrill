const { Pool } = require('pg');
require('dotenv').config({ path: '/home/john/fggrill-1/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    const tables = ['bar_stocktake_records', 'store_stocktake_records', 'kitchen_shift_stock_take', 'kitchen_stocktake_items', 'kitchen_stocktake_shifts', 'central_stock_take_sessions', 'central_stock_take_items', 'pos_shift_stock_counts', 'stock_takes', 'stock_take_lines'];
    for (const t of tables) {
      const { rows } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'updated_at'`, [t]);
      console.log(t, rows.length ? 'has updated_at' : 'NO updated_at');
    }
  } catch (e) { console.error(e.message); }
  finally { client.release(); await pool.end(); }
}
main();
