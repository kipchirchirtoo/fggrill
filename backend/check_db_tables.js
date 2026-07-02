const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log('Testing Supabase REST API connection...');
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL.replace(':6543/', ':5432/'),
      ssl: { rejectUnauthorized: false }
    });
    const client = await pool.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kitchen_shift_pos_consumption'
    `);
    console.log('Columns of kitchen_shift_pos_consumption:');
    res.rows.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
    client.release();
    await pool.end();
  } catch (err) {
    console.error('REST API connection failed:', err.message);
  }
}

test();
