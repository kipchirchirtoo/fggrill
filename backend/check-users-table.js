const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsersTable() {
  try {
    // Get a sample user to see the structure
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Error:', error.message);
      return;
    }

    console.log('Users table structure:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\nColumn names:', Object.keys(data));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUsersTable();
