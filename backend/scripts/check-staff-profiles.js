const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'staff_profiles'
      ORDER BY ordinal_position
    `);
    
    console.log('staff_profiles columns:');
    result.rows.forEach(r => console.log('  -', r.column_name));
    
    // Check if branch_id exists
    const hasBranchId = result.rows.some(r => r.column_name === 'branch_id');
    console.log(`\nbranch_id exists: ${hasBranchId}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

check();
