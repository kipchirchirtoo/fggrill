const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Testing RLS policy creation...\n');
    
    // Drop existing policy
    await client.query(`DROP POLICY IF EXISTS "rooms_select_policy" ON rooms`);
    console.log('✓ Dropped existing policy');
    
    // Create new policy
    await client.query(`
      CREATE POLICY "rooms_select_policy" ON rooms
        FOR SELECT TO authenticated
        USING (branch_id = get_user_branch_id() OR get_user_branch_id() IS NULL)
    `);
    console.log('✓ Created new policy');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
    console.error('Where:', error.where);
  } finally {
    await client.end();
  }
}

test();
