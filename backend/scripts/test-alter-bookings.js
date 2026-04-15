const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Connected');
    
    // Try adding branch_id to bookings
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id INTEGER`);
    console.log('✓ Added branch_id to bookings');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
    console.error('Hint:', error.hint);
    console.error('Position:', error.position);
    console.error('Where:', error.where);
  } finally {
    await client.end();
  }
}

test();
