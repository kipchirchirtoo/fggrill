const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTables() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%dispatch%' 
      ORDER BY table_name
    `);
    
    console.log('Dispatch-related tables:');
    res.rows.forEach(r => console.log('  -', r.table_name));
    
    // Check if dispatch_otps exists
    const otpCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'dispatch_otps'
      ) as exists
    `);
    
    console.log('\ndispatch_otps exists:', otpCheck.rows[0].exists);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTables();
