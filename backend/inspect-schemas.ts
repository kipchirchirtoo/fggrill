import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const tables = [
    'stock_requests',
    'bar_stock_requests'
  ];

  console.log('Querying information_schema.columns via pg...');
  
  for (const table of tables) {
    try {
      const res = await pool.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = $1 AND table_schema = 'public'`,
        [table]
      );
      if (res.rows.length === 0) {
        console.log(`Table ${table}: Not found in public schema.`);
      } else {
        const columns = res.rows.map(r => r.column_name);
        const hasBranchId = columns.includes('branch_id');
        console.log(`Table ${table}: has branch_id? ${hasBranchId}. Columns: ${columns.join(', ')}`);
      }
    } catch (err: any) {
      console.log(`Table ${table}: Query failed: ${err.message}`);
    }
  }
  
  await pool.end();
}
main();
