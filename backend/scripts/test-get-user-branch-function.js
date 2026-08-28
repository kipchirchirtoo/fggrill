const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Creating function...\n');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION get_user_branch_id()
      RETURNS INTEGER AS $$
      DECLARE
        user_branch INTEGER;
      BEGIN
        SELECT branch_id INTO user_branch
        FROM staff_profiles
        WHERE user_id = auth.uid()
        LIMIT 1;
        
        RETURN user_branch;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    
    console.log('✓ Function created successfully');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
    console.error('Where:', error.where);
  } finally {
    await client.end();
  }
}

test();
