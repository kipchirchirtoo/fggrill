const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectTable() {
  const tableName = 'cashier_shift_logs';
  console.log(`Inspecting table: ${tableName}`);
  
  try {
    const res = await pool.query(`
      SELECT 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name, 
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = $1;
    `, [tableName]);
    
    console.log('Foreign Keys:');
    console.table(res.rows);

    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1;
    `, [tableName]);
    
    console.log('Columns:');
    console.table(cols.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectTable();
