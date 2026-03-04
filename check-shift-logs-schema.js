require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('\n=== Checking cashier_shift_logs Schema ===\n');

  const { data, error } = await supabase
    .from('cashier_shift_logs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Available columns:');
    Object.keys(data[0]).forEach(col => {
      const value = data[0][col];
      const type = typeof value;
      const display = value === null ? 'null' : (type === 'object' ? JSON.stringify(value).substring(0, 50) : value);
      console.log(`  - ${col}: ${type} (${display})`);
    });
  } else {
    console.log('No data found in table');
  }

  console.log('\n=== Complete ===\n');
}

checkSchema().catch(console.error);
