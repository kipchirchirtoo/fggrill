const fs = require('fs');
const { Pool } = require('pg');
const newUrl = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();
const pool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check staff_profiles columns
  const spCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff_profiles'
    ORDER BY ordinal_position
  `);
  console.log('=== STAFF_PROFILES COLUMNS ===');
  spCols.rows.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));

  // Check users columns
  const uCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log('\n=== USERS COLUMNS ===');
  uCols.rows.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));

  // Check if staff_profiles has user_id
  const hasUserId = spCols.rows.some(c => c.column_name === 'user_id');
  const hasStaffId = uCols.rows.some(c => c.column_name === 'staff_id');
  console.log(`\nstaff_profiles has user_id: ${hasUserId}`);
  console.log(`users has staff_id: ${hasStaffId}`);

  // Check user creation flow in backend
  await pool.end();
}

check().catch(err => { console.error('ERR:', err.message); pool.end(); });
