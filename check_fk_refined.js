const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkFK() {
  try {
    const res = await pool.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name, 
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'cashier_shift_logs';
    `);
    
    console.log('--- Foreign Keys for cashier_shift_logs ---');
    res.rows.forEach(row => {
      console.log(`${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
    });

    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cashier_shift_logs' AND column_name = 'cashier_id';
    `);
    
    if (columns.rows.length > 0) {
      console.log(`Column cashier_id exists with type: ${columns.rows[0].data_type}`);
    } else {
      console.log('Column cashier_id DOES NOT EXIST in cashier_shift_logs');
    }

    const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%cashier%';
    `);
    console.log('--- Tables containing "cashier" ---');
    tables.rows.forEach(row => console.log(row.table_name));

  } catch (err) {
    console.error('Error during inspection:', err.message);
  } finally {
    await pool.end();
  }
}

checkFK();
