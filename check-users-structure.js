require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log('Checking users table structure...\n');

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Sample user record:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\nAvailable columns:', Object.keys(data[0]).join(', '));
  } else {
    console.log('No users found');
  }
}

checkUsers().catch(console.error);
